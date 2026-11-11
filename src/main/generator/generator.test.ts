// Garde-fou de la génération : une étape IA qui casse la compilation est annulée.
// L'agent est simulé (pas d'appel réseau) ; la compilation TypeScript du template est réelle.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyBrief } from '@shared/brief/schema'
import type { GenerationState } from '@shared/types'

const agentBehaviour: { kind: 'valide' | 'casse' | 'erreur' } = { kind: 'valide' }

vi.mock('./agent', () => ({
  runAgent: async (o: { cwd: string; onActivity: (t: string) => void }) => {
    if (agentBehaviour.kind === 'erreur') return { ok: false, message: 'Invalid API key', filesTouched: [] }
    const page = join(o.cwd, 'src/pages/custom/Planning.tsx')
    o.onActivity('Écrit src/pages/custom/Planning.tsx')
    writeFileSync(page, agentBehaviour.kind === 'valide' ? 'export function Planning() { return <div>Planning</div> }\n' : 'export function Planning() { return <div>{nexistePas}</div> }\n')
    return { ok: true, message: 'Page planning ajoutée', filesTouched: ['src/pages/custom/Planning.tsx'] }
  }
}))

const { Generator } = await import('./generator')
const { listTemplates } = await import('./templates')

const root = join(__dirname, '..', '..', '..')
const templateReady = existsSync(join(root, 'templates/socle/node_modules/typescript'))

function makeGenerator() {
  let state: GenerationState | undefined
  const logs: string[] = []
  const gen = new Generator({
    templates: () => listTemplates(join(root, 'templates')),
    workspacesDir: () => mkdtempSync(join(tmpdir(), 'gen-test-')),
    agentConfig: () => ({ enabled: true, apiKey: 'test', model: 'claude-opus-5-5', effort: 'low', maxMinutes: 1 }),
    log: (m) => logs.push(m),
    onState: (s) => (state = s)
  })
  return { gen, logs, state: () => state! }
}

function brief() {
  const b = emptyBrief()
  b.typeProjet = 'app-metier'
  b.champs.entites = { status: 'obtenu', preuves: [], items: [{ nom: 'Chantier', attributs: ['date de début', 'chef de chantier'] }] }
  return b
}

describe.skipIf(!templateReady)('Generator (agent simulé)', () => {
  beforeEach(() => {
    agentBehaviour.kind = 'valide'
  })

  it('garde une modification qui compile', async () => {
    const { gen, state } = makeGenerator()
    // Pas de preview dans ce test : on prépare l'espace de travail sans démarrer Vite.
    ;(gen as unknown as { preview: undefined }).preview = undefined
    await prepareWithoutPreview(gen)
    gen.onBrief(brief())
    await (gen as unknown as { kick: (k: string) => Promise<void> }).kick('structure')
    const ws = gen.workspaceDir!
    expect(readFileSync(join(ws, 'src/pages/custom/Planning.tsx'), 'utf8')).toContain('Planning')
    expect(state().agentOwnsApp).toBe(true)
    expect(state().steps.find((s) => s.kind === 'structure')?.status).toBe('ok')
    // Après la structure, l'étape « données réalistes » s'enchaîne automatiquement.
    expect(state().steps.some((s) => s.kind === 'donnees')).toBe(true)
    await gen.stop()
  })

  it('annule une modification qui casse la compilation', async () => {
    agentBehaviour.kind = 'casse'
    const { gen, state, logs } = makeGenerator()
    await prepareWithoutPreview(gen)
    gen.onBrief(brief())
    await (gen as unknown as { kick: (k: string) => Promise<void> }).kick('structure')
    expect(existsSync(join(gen.workspaceDir!, 'src/pages/custom/Planning.tsx'))).toBe(false)
    expect(state().steps.find((s) => s.kind === 'structure')?.status).toBe('echec')
    expect(state().agentOwnsApp).toBe(false)
    expect(logs.join('\n')).toContain('retour à la version précédente')
    await gen.stop()
  })

  it("coupe l'IA après 2 échecs consécutifs", async () => {
    agentBehaviour.kind = 'erreur'
    const { gen, logs } = makeGenerator()
    await prepareWithoutPreview(gen)
    const g = gen as unknown as { kick: (k: string) => Promise<void>; agentAvailable: () => boolean }
    gen.onBrief(brief())
    await g.kick('structure')
    await g.kick('structure')
    expect(g.agentAvailable()).toBe(false)
    expect(logs.join('\n')).toContain('coupée pour ce rendez-vous')
    await gen.stop()
  })
})

/** Comme prepare(), sans démarrer le serveur de preview (inutile pour ces tests). */
async function prepareWithoutPreview(gen: InstanceType<typeof Generator>): Promise<void> {
  const { PreviewServer } = await import('./preview')
  const start = vi.spyOn(PreviewServer.prototype, 'start').mockResolvedValue('http://127.0.0.1:0/')
  await gen.prepare({ brand: { nomEntreprise: 'Test', couleurs: { primaire: '#123456' }, sources: [] }, agence: { nom: 'Agence', mention: 'm' }, brief: emptyBrief() })
  start.mockRestore()
}
