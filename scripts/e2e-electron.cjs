// Test de fumée de l'application Electron (scénario de démo, sans clé API) avec captures d'écran.
// Usage : npm run build && xvfb-run -a node scripts/e2e-electron.cjs [dossier-captures]
const { _electron } = require('playwright')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')

const out = path.resolve(process.argv[2] || 'captures-app')
fs.mkdirSync(out, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

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
  await win.setViewportSize({ width: 1400, height: 880 }).catch(() => {})
  await win.waitForSelector('text=Préparer le rendez-vous')
  await wait(500)
  await win.screenshot({ path: path.join(out, '01-accueil.png') })

  await win.click('text=×20')
  await win.click('text=Lancer la démo')
  await win.waitForSelector('text=Lancer la simulation', { timeout: 90_000 })
  await wait(800)
  await win.screenshot({ path: path.join(out, '02-pret.png') })

  await win.click('text=Lancer la simulation')
  await wait(9000)
  await win.screenshot({ path: path.join(out, '03-ecoute.png') })

  await win.click('text=Fenêtre checklist')
  await wait(1500)
  const cl = app.windows().find((w) => w.url().includes('checklist'))
  if (cl) await cl.screenshot({ path: path.join(out, '04-checklist.png') })

  await wait(22000)
  await win.click('text=✓ Finaliser')
  await win.waitForSelector('text=Vérification finale (compilation)', { timeout: 120_000 })
  await wait(2500)
  await win.screenshot({ path: path.join(out, '05-termine.png') })
  if (cl) await cl.screenshot({ path: path.join(out, '06-checklist-fin.png') })

  await win.click('text=Ouvrir la maquette')
  await wait(3000)
  const preview = app.windows().find((w) => w.url().startsWith('http://127.0.0.1'))
  if (preview) {
    await preview.click('button[type=submit]').catch(() => {})
    await wait(1500)
    await preview.screenshot({ path: path.join(out, '07-maquette.png') })
  }
  await app.close().catch(() => {})
  console.log('OK, captures dans', out)
  process.exit(0)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
