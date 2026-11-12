// Test de bout en bout de l'application Electron (rendez-vous de démonstration, sans clé API), avec captures d'écran.
// Parcours : accueil → démonstration → widget pendant l'appel → interface en cours → fin → présentation →
// rendez-vous passé (synthèse, brief, transcription, maquette) → tous les écrans de navigation.
// Usage : npm run build && xvfb-run -a node scripts/e2e-electron.cjs [dossier-captures]
const { _electron } = require('playwright')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')

const out = path.resolve(process.argv[2] || 'captures-app')
fs.mkdirSync(out, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let n = 0
const shot = async (page, name) => {
  const file = path.join(out, `${String(++n).padStart(2, '0')}-${name}.png`)
  await page.screenshot({ path: file })
  console.log('capture', path.basename(file))
}

;(async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'autobuild-e2e-'))
  const env = { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
  delete env.ANTHROPIC_API_KEY
  delete env.GEMINI_API_KEY
  const root = path.resolve(__dirname, '..')
  // AUTOBUILD_EXE=chemin/vers/l'app packagée pour tester l'installeur au lieu des sources.
  const packaged = process.env.AUTOBUILD_EXE
  const executablePath = packaged || require(path.join(root, 'node_modules', 'electron'))
  const args = [...(packaged ? [] : ['.']), '--no-sandbox', `--user-data-dir=${userData}`]
  const app = await _electron.launch({ executablePath, args, cwd: root, env })
  const win = await app.firstWindow()
  await win.setViewportSize({ width: 1440, height: 900 }).catch(() => {})
  const findWindow = async (pred, timeout = 30_000) => {
    const end = Date.now() + timeout
    while (Date.now() < end) {
      const w = app.windows().find(pred)
      if (w) return w
      await wait(200)
    }
    throw new Error('fenêtre introuvable')
  }

  // 1. Premier lancement.
  await win.waitForSelector('text=Bienvenue dans AutoBuild')
  await wait(400)
  await shot(win, 'bienvenue')

  // 2. Démonstration : création du RDV, préparation, fenêtre de lancement.
  await win.click('text=Lancer la démonstration')
  const launch = win.locator('.modal-foot button.rec')
  await win.waitForFunction(() => {
    const b = document.querySelector('.modal-foot button.rec')
    return b && !b.disabled
  }, null, { timeout: 120_000 })
  await win.click('.modal .seg button:has-text("×20")')
  await wait(300)
  await shot(win, 'lancement-demo')
  await launch.click()

  // 3. Pendant l'appel : le widget remplace l'interface.
  const widget = await findWindow((w) => w.url().includes('widget.html'))
  await widget.waitForSelector('.panel')
  await wait(9000)
  await shot(widget, 'widget-pendant')
  await widget.click('button[aria-label="Réduire en pastille"]')
  await wait(800)
  await shot(widget, 'widget-reduit')
  await widget.click('button[aria-label="Déplier la checklist"]')
  await wait(800)

  // 4. Retour à l'interface pendant l'appel (bandeau rouge).
  await widget.click('button[aria-label="Revenir à l’interface AutoBuild"]')
  await win.waitForSelector('.live-banner')
  await wait(600)
  await shot(win, 'interface-en-cours')

  // 5. Fin de la conversation rejouée, puis « Terminer ».
  await wait(17000)
  await shot(widget, 'widget-fin-de-conversation')
  await widget.click('button:has-text("Terminer")')
  await wait(400)
  await shot(widget, 'widget-terminer')
  await widget.click('text=Terminer et montrer la maquette')

  // 6. Présentation de la maquette en plein écran.
  const presentation = await findWindow((w) => w.url().startsWith('http://127.0.0.1'), 180_000)
  await presentation.waitForLoadState()
  await wait(2500)
  await presentation.click('button[type=submit]').catch(() => {})
  await wait(1500)
  await shot(presentation, 'presentation-maquette')
  await presentation.close().catch(() => {})

  // 7. Rendez-vous passé.
  await win.waitForSelector('text=Le besoin en bref', { timeout: 60_000 })
  await wait(600)
  await shot(win, 'rdv-synthese')
  await win.click('.tabs a:has-text("Brief")')
  await win.waitForSelector('text=Pour la maquette')
  await shot(win, 'rdv-brief')
  await win.click('a.rowlink:has-text("Budget")')
  await win.waitForSelector('aside.drawer')
  await wait(300)
  await shot(win, 'rdv-brief-detail')
  await win.click('aside.drawer a:has-text("Voir dans la transcription")')
  await win.waitForSelector('text=Moments clés')
  await wait(600)
  await shot(win, 'rdv-transcription')
  await win.click('.tabs a:has-text("Maquette")')
  await win.waitForSelector('iframe', { timeout: 60_000 })
  await wait(5000)
  await shot(win, 'rdv-maquette')

  // 8. Tous les écrans de navigation.
  const visit = async (hash, sel, name) => {
    await win.evaluate((h) => (window.location.hash = h), hash)
    await win.waitForSelector(sel, { timeout: 20_000 })
    await wait(500)
    await shot(win, name)
  }
  await visit('#/', 'text=Derniers rendez-vous', 'accueil')
  await visit('#/rendez-vous', 'table.table', 'rendez-vous-liste')
  await visit('#/rendez-vous/calendrier', 'text=Aujourd’hui', 'rendez-vous-calendrier')
  await visit('#/prospects', 'text=Identité visuelle', 'prospects')
  await visit('#/templates', 'text=Extranet / portail client', 'templates')
  await visit('#/templates/erp/devis', 'aside.drawer', 'template-erp-page')
  await visit('#/reglages/ia', 'text=Claude Code installé', 'reglages-acces-ia')
  await visit('#/reglages/son', 'text=Tester le son', 'reglages-son')
  await visit('#/aide', 'text=Le parcours d’un rendez-vous', 'aide')
  await win.click('.topbar button.primary')
  await win.waitForSelector('.sheet')
  await wait(400)
  await shot(win, 'nouveau-rendez-vous')
  await win.fill('.sheet input[placeholder="Nom de l’entreprise"]', 'Orvane Laboratoires')
  await win.click('text=Créer et préparer')
  await win.waitForSelector('text=Préparation automatique')
  await wait(4000)
  await shot(win, 'preparation-rdv-a-venir')
  await win.keyboard.press('Control+K')
  await win.waitForSelector('.palette')
  await win.keyboard.type('tern')
  await wait(300)
  await shot(win, 'recherche')

  await app.close().catch(() => {})
  console.log('OK, captures dans', out)
  process.exit(0)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
