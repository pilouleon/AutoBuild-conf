// Processus principal Electron : fenêtres (interface, widget de rendez-vous, présentation), permissions audio, IPC.
//
// Pendant un rendez-vous, l'interface se retire : seul le widget reste visible, par-dessus toutes les fenêtres
// (y compris Teams / Meet / Zoom en plein écran) et invisible dans les partages d'écran.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import { BrowserWindow, app, desktopCapturer, dialog, globalShortcut, ipcMain, nativeImage, screen, session as electronSession, shell } from 'electron'
import { briefToMarkdown, compteRenduEmail, compteRenduHtml } from '@shared/brief/export'
import type { AppData, NouveauRdvInput, Prospect, Rdv, SessionState, Settings, Speaker } from '@shared/types'
import { claudeStructured, claudeVersion, findClaudeCli } from './claude-code/cli'
import { killAllChildren } from './generator/node-runner'
import { toInfo } from './generator/templates'
import { Session } from './session'
import { SettingsStore } from './settings'
import { Store } from './store'
import { listScenarios } from './transcription/scenario'

// Capture de l'audio système sur macOS (ScreenCaptureKit / Core Audio taps) : fonctionnalités Chromium
// à activer avant le démarrage. Sans effet sur Windows, où le « loopback » est natif.
if (process.platform === 'darwin') {
  app.commandLine.appendSwitch('enable-features', 'MacLoopbackAudioForScreenShare,MacCatapLoopbackAudioForScreenShare,MacSckSystemAudioLoopbackOverride')
}

const here = import.meta.dirname
const resources = app.isPackaged ? process.resourcesPath : app.getAppPath()
const preload = join(here, '../preload/index.cjs')
const SHORTCUT = 'CommandOrControl+Alt+C'

let mainWindow: BrowserWindow | undefined
let widgetWindow: BrowserWindow | undefined
let presentWindow: BrowserWindow | undefined
let settingsStore: SettingsStore
let store: Store
let session: Session
type WidgetMode = 'ouvert' | 'reduit'
let widgetMode: WidgetMode = 'ouvert'

function loadRenderer(win: BrowserWindow, page: 'index' | 'widget'): void {
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) void win.loadURL(`${devUrl}/${page}.html`)
  else void win.loadFile(join(here, `../renderer/${page}.html`))
}

function send(channel: string, payload: unknown): void {
  for (const w of [mainWindow, widgetWindow]) if (w && !w.isDestroyed()) w.webContents.send(channel, payload)
}

let lastPhase: SessionState['phase'] = 'inactif'
function onState(state: SessionState): void {
  send('state', state)
  // Le widget se ferme quand le rendez-vous est terminé et que l'interface revient.
  if (state.phase !== lastPhase) {
    if (state.phase === 'termine' || state.phase === 'inactif') {
      closeWidget()
      showMain()
    }
    lastPhase = state.phase
  }
}

// ── Fenêtres ───────────────────────────────────────────────────
function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 880,
    minWidth: 1120,
    minHeight: 700,
    title: 'AutoBuild',
    backgroundColor: '#f6f6f4',
    show: false,
    webPreferences: { preload, sandbox: false, contextIsolation: true, backgroundThrottling: false }
  })
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  loadRenderer(mainWindow, 'index')
  // Pendant un rendez-vous, fermer l'interface la cache seulement : l'écoute continue dans le widget.
  mainWindow.on('close', (e) => {
    const live = session?.state.phase === 'ecoute' || session?.state.phase === 'finalisation'
    if (live) {
      e.preventDefault()
      openWidget()
      mainWindow?.hide()
    }
  })
  mainWindow.on('closed', () => {
    mainWindow = undefined
    widgetWindow?.destroy()
    presentWindow?.destroy()
  })
}

function showMain(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return createMainWindow()
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

/** Taille par défaut du widget : environ 1/5 de la largeur de l'écran, en haut à droite. */
function widgetDefaultBounds(): Electron.Rectangle {
  const wa = screen.getPrimaryDisplay().workArea
  const width = Math.round(Math.min(440, Math.max(320, wa.width / 5)))
  const height = Math.round(Math.min(760, Math.max(460, wa.height * 0.66)))
  return { x: wa.x + wa.width - width - 16, y: wa.y + 16, width, height }
}

function visibleBounds(b: Electron.Rectangle | undefined): Electron.Rectangle {
  if (!b) return widgetDefaultBounds()
  // Écran débranché depuis : on revient à la position par défaut.
  const onScreen = screen.getAllDisplays().some((d) => b.x >= d.bounds.x - 40 && b.y >= d.bounds.y - 40 && b.x + 80 <= d.bounds.x + d.bounds.width && b.y + 40 <= d.bounds.y + d.bounds.height)
  return onScreen ? b : widgetDefaultBounds()
}

function openWidget(): void {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.showInactive()
    return
  }
  const bounds = visibleBounds(settingsStore.get().widget.bounds)
  widgetMode = 'ouvert'
  widgetWindow = new BrowserWindow({
    ...bounds,
    minWidth: 280,
    minHeight: 48,
    title: 'AutoBuild — rendez-vous',
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    minimizable: false,
    maximizable: false,
    backgroundColor: '#15171a',
    show: false,
    webPreferences: { preload, sandbox: false, contextIsolation: true, backgroundThrottling: false }
  })
  // Niveau le plus haut : reste visible même au-dessus d'une visio en plein écran.
  widgetWindow.setAlwaysOnTop(true, 'screen-saver')
  widgetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  // Invisible lors d'un partage d'écran : le prospect ne voit jamais le widget.
  widgetWindow.setContentProtection(true)
  loadRenderer(widgetWindow, 'widget')
  widgetWindow.once('ready-to-show', () => widgetWindow?.showInactive())
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  const saveBounds = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (!widgetWindow || widgetWindow.isDestroyed() || widgetMode !== 'ouvert') return
      const s = settingsStore.get()
      settingsStore.save({ ...s, widget: { ...s.widget, bounds: widgetWindow.getBounds() } })
    }, 500)
  }
  widgetWindow.on('moved', saveBounds)
  widgetWindow.on('resized', saveBounds)
  widgetWindow.on('closed', () => (widgetWindow = undefined))
}

function closeWidget(): void {
  if (widgetWindow && !widgetWindow.isDestroyed()) widgetWindow.destroy()
  widgetWindow = undefined
}

/** Widget réduit : une pastille (enregistrement + avancement), ou panneau complet. */
function setWidgetMode(mode: WidgetMode): void {
  if (!widgetWindow || widgetWindow.isDestroyed()) return
  const b = widgetWindow.getBounds()
  if (mode === 'reduit' && widgetMode === 'ouvert') {
    const s = settingsStore.get()
    settingsStore.save({ ...s, widget: { ...s.widget, bounds: b } })
    widgetWindow.setBounds({ x: b.x + b.width - 300, y: b.y, width: 300, height: 52 })
  } else if (mode === 'ouvert' && widgetMode === 'reduit') {
    const saved = visibleBounds(settingsStore.get().widget.bounds)
    widgetWindow.setBounds({ x: b.x + 300 - saved.width, y: b.y, width: saved.width, height: saved.height })
  }
  widgetMode = mode
  widgetWindow.webContents.send('widget:mode', mode)
}

/** Présentation de la maquette au prospect (plein écran, Échap pour sortir). */
async function present(rdvId: string): Promise<void> {
  const url = await session.viewMaquette(rdvId)
  const rdv = store.rdv(rdvId)
  const nom = rdv ? (store.prospect(rdv.prospectId)?.nom ?? '') : ''
  if (presentWindow && !presentWindow.isDestroyed()) presentWindow.destroy()
  presentWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    title: `Maquette — ${nom}`,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: { contextIsolation: true, sandbox: true }
  })
  presentWindow.webContents.on('before-input-event', (e, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown' && presentWindow?.isFullScreen()) {
      e.preventDefault()
      presentWindow.setFullScreen(false)
    }
  })
  presentWindow.on('page-title-updated', (e) => e.preventDefault())
  presentWindow.on('closed', () => (presentWindow = undefined))
  await presentWindow.loadURL(url)
  presentWindow.setFullScreen(true)
}

function setupPermissions(): void {
  const ses = electronSession.defaultSession
  ses.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'media' || permission === 'display-capture'))
  ses.setPermissionCheckHandler((_wc, permission) => permission === 'media' || permission === 'display-capture')
  // Audio système : on répond à getDisplayMedia avec l'écran principal + l'audio « loopback », sans fenêtre de choix.
  ses.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen'] })
        .then((sources) => callback(sources[0] ? { video: sources[0], audio: 'loopback' } : {}))
        .catch(() => callback({}))
    },
    { useSystemPicker: false }
  )
}

// ── Compte rendu ───────────────────────────────────────────────
function crOptions(rdv: Rdv) {
  const prospect = store.prospect(rdv.prospectId)
  return {
    entreprise: prospect?.nom ?? '',
    titre: `Compte rendu — ${rdv.titre}`,
    date: new Date(rdv.startedAt ?? rdv.debut),
    commercial: rdv.commercial,
    interlocuteurs: rdv.interlocuteurs.map((c) => c.nom),
    dureeMin: rdv.startedAt && rdv.endedAt ? Math.max(1, Math.round((rdv.endedAt - rdv.startedAt) / 60_000)) : undefined
  }
}

function exportDir(rdv: Rdv): string {
  const dir = rdv.maquette.workspace ?? join(app.getPath('documents'), 'AutoBuild')
  mkdirSync(dir, { recursive: true })
  return dir
}

function rdvOrThrow(id: string): Rdv {
  const r = store.rdv(id)
  if (!r) throw new Error('Rendez-vous introuvable.')
  return r
}

// ── IPC ────────────────────────────────────────────────────────
function registerIpc(): void {
  ipcMain.handle('state:get', () => session.state)
  ipcMain.handle('data:get', () => store.all())
  ipcMain.handle('settings:get', () => settingsStore.get())
  ipcMain.handle('settings:save', (_e, s: Settings) => settingsStore.save(s))
  const keysStatus = async () => ({ ...(await session.keysStatus()), chiffrement: settingsStore.encryptionAvailable() })
  ipcMain.handle('keys:status', keysStatus)
  ipcMain.handle('keys:set', (_e, name: 'anthropic' | 'gemini', value: string) => {
    settingsStore.setKey(name, value)
    return keysStatus()
  })
  ipcMain.handle('claude-code:test', async () => {
    const cli = await session.refreshClaudeCli().then((c) => c ?? findClaudeCli(settingsStore.get().claude.cliPath))
    if (!cli) return { ok: false, message: 'Claude Code introuvable. Installez-le (voir le guide), ou indiquez le chemin de « claude » dans les réglages.' }
    const version = await claudeVersion(cli)
    try {
      const { data } = await claudeStructured<{ reponse: string }>({
        cli,
        model: settingsStore.get().models.claudeBrief,
        system: 'Tu réponds au test de connexion d’une application.',
        prompt: 'Réponds « OK ».',
        schema: { type: 'object', properties: { reponse: { type: 'string' } }, required: ['reponse'], additionalProperties: false },
        cwd: app.getPath('userData'),
        timeoutMs: 90_000,
        effort: 'low'
      })
      return { ok: true, message: `Connecté (${version ?? 'version inconnue'}) : « ${data.reponse} »`, path: cli.path }
    } catch (err) {
      return { ok: false, message: `${(err as Error).message}${version ? ` (${version})` : ''}`, path: cli.path }
    }
  })
  ipcMain.handle('keys:test', async () => {
    const k = settingsStore.getKeys()
    const s = settingsStore.get()
    const out: { anthropic?: string; gemini?: string } = {}
    if (k.anthropic && s.claude.mode === 'api') {
      try {
        const m = await new Anthropic({ apiKey: k.anthropic }).models.retrieve(s.models.claudeBrief)
        out.anthropic = `OK (${m.display_name})`
      } catch (err) {
        out.anthropic = `Erreur : ${(err as Error).message}`
      }
    }
    if (k.gemini) {
      try {
        const m = await new GoogleGenAI({ apiKey: k.gemini }).models.get({ model: s.models.geminiTranscription })
        out.gemini = `OK (${m.displayName ?? m.name})`
      } catch (err) {
        out.gemini = `Erreur : ${(err as Error).message}`
      }
    }
    return out
  })
  ipcMain.handle('scenarios:list', () => listScenarios(join(resources, 'scenarios')))
  ipcMain.handle('templates:list', () => session.templates().map(toInfo))

  // Rendez-vous et prospects (enregistrés sur ce poste).
  const prepareInBackground = (id: string) => void session.prepareRdv(id).catch(() => {})
  ipcMain.handle('rdv:create', (_e, input: NouveauRdvInput) => {
    const rdv = session.createRdv(input)
    prepareInBackground(rdv.id)
    return rdv
  })
  ipcMain.handle('rdv:demo', (_e, scenarioId: string) => {
    const rdv = session.createDemoRdv(scenarioId)
    prepareInBackground(rdv.id)
    return rdv
  })
  ipcMain.handle('rdv:update', (_e, id: string, patch: Partial<Pick<Rdv, 'debut' | 'dureeMin' | 'lienVisio' | 'contexte' | 'notes' | 'interlocuteurs' | 'templateChoisi'>>) => {
    const before = rdvOrThrow(id)
    const templateChange = patch.templateChoisi !== undefined && patch.templateChoisi !== before.templateChoisi
    const r = store.updateRdv(id, (x) => Object.assign(x, patch))
    // Template changé avant l'appel : la maquette de départ est refaite.
    if (templateChange && r && r.statut !== 'termine' && r.statut !== 'en_cours') prepareInBackground(id)
    return r
  })
  ipcMain.handle('rdv:delete', (_e, id: string) => {
    if (session.state.rdvId === id && session.state.phase !== 'inactif') throw new Error('Ce rendez-vous est en cours.')
    store.deleteRdv(id)
  })
  ipcMain.handle('rdv:prepare', (_e, id: string) => session.prepareRdv(id))
  ipcMain.handle('prospect:update', (_e, id: string, patch: Partial<Pick<Prospect, 'nom' | 'siteUrl' | 'secteur' | 'notes' | 'interlocuteurs'>>) => store.updateProspect(id, (p) => Object.assign(p, patch)))

  // Rendez-vous en direct.
  ipcMain.handle('live:open', (_e, rdvId: string, speed?: number) => session.open(rdvId, { speed }))
  ipcMain.handle('live:start', async () => {
    await session.startListening()
    // L'interface se retire, le widget prend le relais.
    openWidget()
    mainWindow?.hide()
  })
  ipcMain.handle('live:pause', (_e, v: boolean) => session.setPause(v))
  ipcMain.handle('live:finish', () => session.finish())
  ipcMain.handle('live:close', () => session.close())
  ipcMain.handle('live:speed', (_e, n: number) => session.setSimulationSpeed(n))
  ipcMain.handle('live:brief-mode', (_e, rejoue: boolean) => session.setSimulationBriefMode(rejoue))
  ipcMain.handle('live:consent', (_e, v: boolean) => session.setConsent(v))
  ipcMain.handle('brief:run', () => session.runBrief(true))
  ipcMain.handle('brief:manual', (_e, rdvId: string, fieldId: string, v: string) => session.setManualRdv(rdvId, fieldId, v))
  ipcMain.handle('generation:rollback', (_e, t: 'planB' | 'lastGood') => session.rollback(t))
  ipcMain.handle('generation:cancel', () => session.cancelAgent())

  // Fenêtres.
  ipcMain.handle('window:main', () => showMain())
  ipcMain.handle('widget:show', () => {
    if (session.state.phase === 'ecoute' || session.state.phase === 'finalisation') {
      openWidget()
      mainWindow?.hide()
    }
  })
  ipcMain.handle('widget:hide', () => {
    closeWidget()
    showMain()
  })
  ipcMain.handle('widget:mode', (_e, mode: WidgetMode) => setWidgetMode(mode))
  ipcMain.handle('widget:get-mode', () => widgetMode)

  // Maquettes.
  ipcMain.handle('maquette:view', (_e, rdvId: string) => session.viewMaquette(rdvId))
  ipcMain.handle('maquette:present', (_e, rdvId: string) => present(rdvId))
  ipcMain.handle('maquette:restore', (_e, rdvId: string, versionId: string) => session.restoreVersion(rdvId, versionId))
  ipcMain.handle('maquette:folder', (_e, rdvId: string) => {
    const dir = rdvOrThrow(rdvId).maquette.workspace
    if (dir) void shell.openPath(dir)
  })

  // Compte rendu.
  ipcMain.handle('export:markdown', (_e, rdvId: string) => {
    const rdv = rdvOrThrow(rdvId)
    const md = briefToMarkdown(rdv.brief, { ...crOptions(rdv), transcript: rdv.transcript })
    const file = join(exportDir(rdv), `compte-rendu-${rdv.debut.slice(0, 10)}.md`)
    writeFileSync(file, md, 'utf8')
    shell.showItemInFolder(file)
    return file
  })
  ipcMain.handle('export:email', (_e, rdvId: string) => {
    const rdv = rdvOrThrow(rdvId)
    return compteRenduEmail(rdv.brief, crOptions(rdv))
  })
  ipcMain.handle('export:pdf', async (_e, rdvId: string) => {
    const rdv = rdvOrThrow(rdvId)
    const md = briefToMarkdown(rdv.brief, crOptions(rdv))
    const html = compteRenduHtml(md, { couleur: rdv.brand?.couleurs.primaire, logoDataUrl: rdv.brand?.logoDataUrl, agence: settingsStore.get().agence.nom })
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
    try {
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      const pdf = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 } })
      const file = join(exportDir(rdv), `compte-rendu-${rdv.debut.slice(0, 10)}.pdf`)
      writeFileSync(file, pdf)
      shell.showItemInFolder(file)
      return file
    } finally {
      win.destroy()
    }
  })

  ipcMain.handle('dialog:folder', async (_e, title: string) => {
    const r = await dialog.showOpenDialog({ title, properties: ['openDirectory', 'createDirectory'] })
    return r.canceled ? undefined : r.filePaths[0]
  })
  ipcMain.handle('dialog:image', async (_e, title: string) => {
    const r = await dialog.showOpenDialog({ title, properties: ['openFile'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }] })
    return r.canceled ? undefined : r.filePaths[0]
  })
  ipcMain.handle('shell:open', (_e, url: string) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
  })

  // Audio (envoi sans réponse, flux continu).
  ipcMain.on('audio:chunk', (_e, speaker: Speaker, startMs: number, endMs: number, wav: Uint8Array) => session.pushChunk(speaker, startMs, endMs, wav))
  ipcMain.on('audio:pcm', (_e, speaker: Speaker, pcm: Uint8Array, atMs: number) => session.pushPcm(speaker, pcm, atMs))
  ipcMain.on('audio:levels', (_e, levels: Record<Speaker, number>) => session.setLevels(levels))
}

app.whenReady().then(() => {
  settingsStore = new SettingsStore()
  store = new Store(app.getPath('userData'), (d: AppData) => send('data', d))
  session = new Session({
    settings: () => settingsStore.get(),
    keys: () => settingsStore.getKeys(),
    store,
    templatesRoot: join(resources, 'templates'),
    scenariosRoot: join(resources, 'scenarios'),
    dataDir: app.getPath('userData'),
    decodeImage: (bytes) => {
      const img = nativeImage.createFromBuffer(Buffer.from(bytes))
      if (img.isEmpty()) return undefined
      const small = img.getSize().width > 256 ? img.resize({ width: 256 }) : img
      const { width, height } = small.getSize()
      return { data: new Uint8Array(small.toBitmap()), width, height, bgra: true }
    },
    onState
  })
  setupPermissions()
  registerIpc()
  createMainWindow()
  // Raccourci global : passer du widget à l'interface (et inversement) pendant un rendez-vous.
  globalShortcut.register(SHORTCUT, () => {
    const live = session.state.phase === 'ecoute' || session.state.phase === 'finalisation'
    if (!live) return showMain()
    if (widgetWindow && !widgetWindow.isDestroyed() && widgetWindow.isVisible()) {
      closeWidget()
      showMain()
    } else {
      openWidget()
      mainWindow?.hide()
    }
  })
  app.on('activate', () => {
    if (!mainWindow) createMainWindow()
    else showMain()
  })
})

app.on('window-all-closed', () => {
  void session?.dispose().finally(() => app.quit())
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  store?.flush()
  killAllChildren()
})
