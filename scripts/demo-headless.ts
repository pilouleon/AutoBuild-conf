// Démo de bout en bout SANS interface : scénario rejoué → brief → maquette → preview.
//
//   npm run demo:headless                       (sans clé API : brief rejoué + maquette de base)
//   ANTHROPIC_API_KEY=… npm run demo:headless   (brief par Claude + agent de génération)
//   npm run demo:headless -- --vitesse 40 --captures dossier/
//
// Sert aussi de test d'intégration (le processus sort en erreur si la maquette ne compile pas).

import { mkdirSync, mkdtempSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { progress } from '../src/shared/brief/schema'
import { Session } from '../src/main/session'
import { defaultSettings } from '../src/main/settings-defaults'

const args = process.argv.slice(2)
const arg = (name: string, def: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : def
}
const scenarioId = arg('scenario', 'ternovia-chantiers')
const speed = Number(arg('vitesse', '30'))
const shotsDir = args.includes('--captures') ? resolve(arg('captures', 'captures')) : undefined
const keep = args.includes('--garder')

const root = resolve(import.meta.dirname, '..')
const settings = defaultSettings()
settings.workspacesDir = mkdtempSync(join(tmpdir(), 'autobuild-maquettes-'))
settings.briefIntervalSec = 20
settings.agence = { nom: 'Agence Démo', mention: 'Maquette de travail, données fictives' }
const keys = { anthropic: process.env.ANTHROPIC_API_KEY, gemini: process.env.GEMINI_API_KEY }
if (!keys.anthropic && keys.gemini) settings.briefProvider = 'gemini'

let lastLog = 0
const session = new Session({
  settings: () => settings,
  keys: () => keys,
  templatesRoot: join(root, 'templates'),
  scenariosRoot: join(root, 'scenarios'),
  dataDir: mkdtempSync(join(tmpdir(), 'autobuild-data-')),
  onState: (s) => {
    for (const l of s.logs.slice(lastLog)) console.log(`[${l.source}] ${l.level === 'error' ? '✖' : l.level === 'warn' ? '!' : l.level === 'success' ? '✔' : '·'} ${l.message}`)
    lastLog = s.logs.length
  }
})

async function main() {
  console.log(`Scénario ${scenarioId}, vitesse ×${speed}, clés : Claude ${keys.anthropic ? 'oui' : 'non'}, Gemini ${keys.gemini ? 'oui' : 'non'}`)
  await session.prepare({ nom: '', url: '', notes: '' }, scenarioId)
  session.setSimulationSpeed(speed)
  const prepared = session.state.generation
  if (!prepared.previewUrl) throw new Error('La preview n’a pas démarré')
  console.log(`Preview : ${prepared.previewUrl}`)
  await session.startListening()
  const scenarioEnd = Math.ceil(((session.state.simulation ? 560 : 0) * 1000) / speed) + 3000
  await new Promise((r) => setTimeout(r, scenarioEnd))
  await session.finalize()
  const s = session.state
  console.log(`\nTranscript : ${s.transcript.length} segments`)
  console.log(`Brief : type ${s.brief.typeProjet}, rempli à ${progress(s.brief).pct} %, ${s.briefStatus.rejected} mises à jour rejetées`)
  console.log(`Étapes de génération :`)
  for (const st of s.generation.steps) console.log(`  - [${st.status}] ${st.label}${st.message ? ` — ${st.message}` : ''}`)
  console.log(`Maquette : ${s.generation.workspace}`)

  if (shotsDir) await screenshots(s.generation.previewUrl!, shotsDir)
  const failed = s.generation.steps.some((st) => st.kind === 'verification' && st.status === 'echec')
  if (!keep) await session.dispose()
  if (failed) process.exit(1)
  if (!keep) process.exit(0)
  console.log('Preview laissée en marche (--garder). Ctrl+C pour arrêter.')
}

async function screenshots(url: string, dir: string) {
  mkdirSync(dir, { recursive: true })
  // Playwright est optionnel (préinstallé dans certains environnements).
  let chromium: { launch: () => Promise<any> } | undefined
  try {
    chromium = createRequire(import.meta.url)('playwright').chromium
  } catch {
    return console.log('Playwright absent : pas de captures.')
  }
  const browser = await chromium!.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(url)
  await page.waitForTimeout(800)
  await page.screenshot({ path: join(dir, '01-connexion.png') })
  await page.click('button[type=submit]')
  await page.waitForTimeout(800)
  await page.screenshot({ path: join(dir, '02-tableau-de-bord.png') })
  const links: string[] = await page.$$eval('aside nav a', (as: { getAttribute(n: string): string | null }[]) => as.map((a) => a.getAttribute('href') ?? ''))
  let i = 3
  for (const href of links.slice(1, 6)) {
    await page.goto(url + href)
    await page.waitForTimeout(500)
    await page.screenshot({ path: join(dir, `${String(i++).padStart(2, '0')}-${href?.replace(/[#/]/g, '') || 'page'}.png`) })
  }
  await browser.close()
  console.log(`Captures dans ${dir}`)
}

main().catch(async (err) => {
  console.error(err)
  await session.dispose().catch(() => {})
  process.exit(1)
})
