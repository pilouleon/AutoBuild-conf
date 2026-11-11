// Processus principal Electron : fenêtres, permissions audio, IPC, session.

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import { BrowserWindow, app, desktopCapturer, dialog, ipcMain, nativeImage, session as electronSession, shell } from 'electron'
import { briefToMarkdown } from '@shared/brief/export'
import type { SessionState, Settings, Speaker } from '@shared/types'
import { killAllChildren } from './generator/node-runner'
import { toInfo } from './generator/templates'
import { Session } from './session'
import { SettingsStore } from './settings'
import { listScenarios } from './transcription/scenario'

// Capture de l'audio système sur macOS (ScreenCaptureKit / Core Audio taps) : fonctionnalités Chromium
// à activer avant le démarrage. Sans effet sur Windows, où le « loopback » est natif.
if (process.platform === 'darwin') {
  app.commandLine.appendSwitch('enable-features', 'MacLoopbackAudioForScreenShare,MacCatapLoopbackAudioForScreenShare,MacSckSystemAudioLoopbackOverride')
}

const here = import.meta.dirname
const resources = app.isPackaged ? process.resourcesPath : app.getAppPath()
const preload = join(here, '../preload/index.cjs')

let mainWindow: BrowserWindow | undefined
let checklistWindow: BrowserWindow | undefined
let previewWindow: BrowserWindow | undefined
let store: SettingsStore
let session: Session

function loadRenderer(win: BrowserWindow, page: 'index' | 'checklist'): void {
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) void win.loadURL(`${devUrl}/${page}.html`)
  else void win.loadFile(join(here, `../renderer/${page}.html`))
}

function broadcast(state: SessionState): void {
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed() && w !== previewWindow) w.webContents.send('state', state)
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    title: 'AutoBuild',
    backgroundColor: '#f7f7f5',
    webPreferences: { preload, sandbox: false, contextIsolation: true }
  })
  loadRenderer(mainWindow, 'index')
  mainWindow.on('closed', () => {
    mainWindow = undefined
    checklistWindow?.close()
  })
}

function openChecklist(): void {
  if (checklistWindow && !checklistWindow.isDestroyed()) {
    checklistWindow.show()
    return
  }
  checklistWindow = new BrowserWindow({
    width: 380,
    height: 680,
    minWidth: 300,
    minHeight: 360,
    title: 'Checklist',
    alwaysOnTop: true,
    frame: false,
    backgroundColor: '#111315',
    webPreferences: { preload, sandbox: false, contextIsolation: true }
  })
  checklistWindow.setAlwaysOnTop(true, 'floating')
  // Invisible lors d'un partage d'écran : le prospect ne voit jamais la checklist.
  checklistWindow.setContentProtection(true)
  if (process.platform === 'darwin') checklistWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  loadRenderer(checklistWindow, 'checklist')
  checklistWindow.on('closed', () => (checklistWindow = undefined))
}

function openPreview(): void {
  const url = session.state.generation.previewUrl
  if (!url) return
  if (previewWindow && !previewWindow.isDestroyed()) {
    previewWindow.show()
    previewWindow.focus()
    return
  }
  previewWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    title: `Maquette — ${session.state.brand?.nomEntreprise ?? ''}`,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true }
  })
  void previewWindow.loadURL(url)
  previewWindow.on('page-title-updated', (e) => e.preventDefault())
  previewWindow.on('closed', () => (previewWindow = undefined))
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

function registerIpc(): void {
  ipcMain.handle('state:get', () => session.state)
  ipcMain.handle('settings:get', () => store.get())
  ipcMain.handle('settings:save', (_e, s: Settings) => store.save(s))
  const keysStatus = () => ({ ...session.keysStatus(), chiffrement: store.encryptionAvailable() })
  ipcMain.handle('keys:status', keysStatus)
  ipcMain.handle('keys:set', (_e, name: 'anthropic' | 'gemini', value: string) => {
    store.setKey(name, value)
    return keysStatus()
  })
  ipcMain.handle('keys:test', async () => {
    const k = store.getKeys()
    const s = store.get()
    const out: { anthropic?: string; gemini?: string } = {}
    if (k.anthropic) {
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
  ipcMain.handle('session:prepare', (_e, p: { nom: string; url: string; notes: string }) => session.prepare(p))
  ipcMain.handle('session:prepare-scenario', async (_e, id: string, speed: number) => {
    await session.prepare({ nom: '', url: '', notes: '' }, id)
    session.setSimulationSpeed(speed)
  })
  ipcMain.handle('session:start', () => session.startListening())
  ipcMain.handle('session:stop', () => session.stopListening())
  ipcMain.handle('session:finalize', () => session.finalize())
  ipcMain.handle('session:reset', () => {
    previewWindow?.close()
    return session.reset()
  })
  ipcMain.handle('session:speed', (_e, n: number) => session.setSimulationSpeed(n))
  ipcMain.handle('session:consent', (_e, v: boolean) => session.setConsent(v))
  ipcMain.handle('brief:manual', (_e, id: string, v: string) => session.setManual(id, v))
  ipcMain.handle('brief:run', () => session.runBrief(true))
  ipcMain.handle('generation:rollback', (_e, t: 'planB' | 'lastGood') => session.rollback(t))
  ipcMain.handle('generation:cancel', () => session.cancelAgent())
  ipcMain.handle('window:preview', () => openPreview())
  ipcMain.handle('window:checklist', () => openChecklist())
  ipcMain.handle('window:workspace', () => {
    const dir = session.workspaceDir
    if (dir) void shell.openPath(dir)
  })
  ipcMain.handle('brief:export', () => {
    const s = session.state
    const md = briefToMarkdown(s.brief, { entreprise: s.brand?.nomEntreprise ?? s.prospect.nom, transcript: s.transcript })
    const dir = session.workspaceDir ?? app.getPath('documents')
    const file = join(dir, `brief-${new Date().toISOString().slice(0, 10)}.md`)
    writeFileSync(file, md, 'utf8')
    shell.showItemInFolder(file)
    return file
  })
  ipcMain.handle('dialog:folder', async (_e, title: string) => {
    const r = await dialog.showOpenDialog({ title, properties: ['openDirectory', 'createDirectory'] })
    return r.canceled ? undefined : r.filePaths[0]
  })
  ipcMain.handle('dialog:image', async (_e, title: string) => {
    const r = await dialog.showOpenDialog({ title, properties: ['openFile'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'svg', 'webp'] }] })
    return r.canceled ? undefined : r.filePaths[0]
  })

  // Audio (envoi sans réponse, flux continu).
  ipcMain.on('audio:chunk', (_e, speaker: Speaker, startMs: number, endMs: number, wav: Uint8Array) => session.pushChunk(speaker, startMs, endMs, wav))
  ipcMain.on('audio:pcm', (_e, speaker: Speaker, pcm: Uint8Array, atMs: number) => session.pushPcm(speaker, pcm, atMs))
  ipcMain.on('audio:levels', (_e, levels: Record<Speaker, number>) => session.setLevels(levels))
}

app.whenReady().then(() => {
  store = new SettingsStore()
  session = new Session({
    settings: () => store.get(),
    keys: () => store.getKeys(),
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
    onState: broadcast
  })
  setupPermissions()
  registerIpc()
  createMainWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  void session?.dispose().finally(() => app.quit())
})

app.on('will-quit', () => killAllChildren())
