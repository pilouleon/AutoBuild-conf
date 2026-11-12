// Test de la chaîne audio de l'application (micro factice de Chromium → AudioWorklet → découpage → IPC),
// par le vrai parcours : nouveau rendez-vous → fenêtre de lancement (niveaux en direct) → accord → enregistrement.
// Usage : npm run build && xvfb-run -a node scripts/e2e-audio.cjs [capture.png]
const { _electron } = require('playwright')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const root = path.resolve(__dirname, '..')
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'autobuild-audio-'))
  const env = { ...process.env, AUTOBUILD_TRANSCRIPTION_TEST: '1' }
  delete env.ANTHROPIC_API_KEY
  delete env.GEMINI_API_KEY
  const app = await _electron.launch({
    executablePath: require(path.join(root, 'node_modules', 'electron')),
    args: ['.', '--no-sandbox', `--user-data-dir=${userData}`, '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    cwd: root,
    env
  })
  const win = await app.firstWindow()
  await win.setViewportSize({ width: 1440, height: 900 }).catch(() => {})
  await win.waitForSelector('text=Bienvenue dans AutoBuild')
  await win.click('text=Planifier un vrai rendez-vous')
  await win.fill('.sheet input[placeholder="Nom de l’entreprise"]', 'Test Audio')
  await win.click('text=Créer et préparer')
  await win.waitForSelector('text=Préparation automatique')
  await win.click('button:has-text("Démarrer le rendez-vous")')
  // Le micro factice émet un bip : le niveau du micro doit bouger dans la fenêtre de lancement.
  await win.waitForSelector('text=On vous entend', { timeout: 60_000 }).catch(async (e) => {
    await win.screenshot({ path: process.argv[2] || 'audio.png' })
    throw e
  })
  await win.screenshot({ path: process.argv[2] || 'audio.png' })
  await win.click('.modal label.check input[type=checkbox]')
  await win.waitForFunction(() => {
    const b = document.querySelector('.modal-foot button.rec')
    return b && !b.disabled
  }, null, { timeout: 120_000 })
  await win.click('.modal-foot button.rec')
  await wait(20_000)
  const state = await win.evaluate(() => window.autobuild.getState())
  const texts = state.transcript.map((s) => `${s.speaker} : ${s.text}`)
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
  console.log(texts.join('\n'))
  if (!texts.some((t) => t.includes('tronçon audio reçu'))) {
    console.error('ÉCHEC : aucun tronçon audio reçu')
    process.exit(1)
  }
  console.log('OK : la chaîne audio fonctionne')
  process.exit(0)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
