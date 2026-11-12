// Démo de bout en bout SANS interface : scénario rejoué → brief → maquette → preview.
//
//   npm run demo:headless                       (sans clé API : brief rejoué + maquette de base)
//   ANTHROPIC_API_KEY=… npm run demo:headless   (brief par Claude + agent de génération)
//   npm run demo:headless -- --vitesse 40 --captures dossier/
//   npm run demo:headless -- --template extranet --captures dossier/   (forcer un template)
//
// Sert aussi de test d'intégration (le processus sort en erreur si la maquette ne compile pas).

import { mkdirSync, mkdtempSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { progress } from '../src/shared/brief/schema'
import { Session } from '../src/main/session'
import { Store } from '../src/main/store'
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
const template = arg('template', 'auto')

const root = resolve(import.meta.dirname, '..')
const settings = defaultSettings()
settings.workspacesDir = mkdtempSync(join(tmpdir(), 'autobuild-maquettes-'))
settings.briefIntervalSec = 20
settings.agence = { nom: 'Agence Démo', mention: 'Maquette de travail, données fictives' }
const keys = { anthropic: process.env.ANTHROPIC_API_KEY, gemini: process.env.GEMINI_API_KEY }
if (!keys.anthropic && keys.gemini) settings.briefProvider = 'gemini'

let lastLog = 0
const dataDir = mkdtempSync(join(tmpdir(), 'autobuild-data-'))
const store = new Store(dataDir)
const session = new Session({
  settings: () => settings,
  keys: () => keys,
  store,
  templatesRoot: join(root, 'templates'),
  scenariosRoot: join(root, 'scenarios'),
  dataDir,
  onState: (s) => {
    for (const l of s.logs.slice(lastLog)) console.log(`[${l.source}] ${l.level === 'error' ? '✖' : l.level === 'warn' ? '!' : l.level === 'success' ? '✔' : '·'} ${l.message}`)
    lastLog = s.logs.length
  }
})

async function main() {
  console.log(`Scénario ${scenarioId}, vitesse ×${speed}, clés : Claude ${keys.anthropic ? 'oui' : 'non'}, Gemini ${keys.gemini ? 'oui' : 'non'}`)
  // Comme dans l'application : RDV créé, préparé à l'avance, puis lancé.
  const rdv = session.createDemoRdv(scenarioId, template)
  await session.prepareRdv(rdv.id)
  const ready = store.rdv(rdv.id)!
  console.log(`Préparation : ${ready.statut} — ${ready.preparation.etapes.map((e) => `${e.label} ${e.statut}${e.detail ? ` (${e.detail})` : ''}`).join(' · ')}`)
  await session.open(rdv.id, { speed })
  const prepared = session.state.generation
  if (!prepared.previewUrl) throw new Error('La preview n’a pas démarré')
  console.log(`Preview : ${prepared.previewUrl}`)
  await session.startListening()
  const scenarioEnd = Math.ceil(((session.state.simulation ? 560 : 0) * 1000) / speed) + 3000
  await new Promise((r) => setTimeout(r, scenarioEnd))
  await session.finish()
  const s = session.state
  const saved = store.rdv(rdv.id)!
  console.log(`Rendez-vous enregistré : ${saved.statut}, ${saved.transcript.length} segments, ${saved.maquette.versions.length} versions de maquette`)
  if (saved.statut !== 'termine' || saved.transcript.length !== s.transcript.length) throw new Error('Le rendez-vous n’a pas été enregistré correctement')
  console.log(`\nTranscript : ${s.transcript.length} segments`)
  console.log(`Brief : type ${s.brief.typeProjet}, rempli à ${progress(s.brief).pct} %, ${s.briefStatus.rejected} mises à jour rejetées, infos ajoutées : ${s.brief.champsAjoutes.map((f) => f.label).join(', ') || 'aucune'}`)
  console.log(`Template : ${s.generation.templateName}`)
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
  const links: string[] = await page.$$eval('nav a', (as: { getAttribute(n: string): string | null }[]) => as.map((a) => a.getAttribute('href') ?? ''))
  let i = 3
  for (const href of links.slice(1, 14)) {
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
