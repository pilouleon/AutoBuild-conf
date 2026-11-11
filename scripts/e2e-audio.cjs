// Test de la chaîne audio de l'application (micro factice de Chromium → AudioWorklet → découpage → IPC).
// Usage : npm run build && xvfb-run -a node scripts/e2e-audio.cjs
const { _electron } = require('playwright')
const path = require('node:path')
const fs = require('node:fs')
const os = require('node:os')

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
  await win.waitForSelector('text=Préparer le rendez-vous')
  await win.fill('input[placeholder="ex. Ternovia"]', 'Test Audio')
  await win.click('text=Préparer la maquette')
  await win.waitForSelector('text=Démarrer l’écoute', { timeout: 90_000 })
  await win.click('label.alert input[type=checkbox]')
  await win.click('text=Démarrer l’écoute')
  await new Promise((r) => setTimeout(r, 20_000))
  const texts = await win.$$eval('.bubble', (els) => els.map((e) => e.textContent))
  await win.screenshot({ path: process.argv[2] || 'audio.png' })
  await app.close().catch(() => {})
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
