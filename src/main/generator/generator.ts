// Orchestrateur de génération : du brief à la maquette, pendant l'appel.
//
//  1. Préparation (avant l'appel) : copie du template, marque du prospect, version de base, preview, plan B.
//  2. Pendant l'appel : à chaque mise à jour du brief, la version de base est régénérée (tant que l'IA
//     n'a pas pris la main), puis l'agent IA fait des étapes de sur-mesure en tâche de fond.
//  3. Garde-fou : après chaque étape IA, la maquette est compilée ; si ça casse, retour à l'instantané précédent.
//  4. Fin d'appel : étape de finition + vérification.

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { briefStateForPrompt } from '@shared/brief/prompt'
import type { Brief } from '@shared/brief/schema'
import { buildAppConfig, slugify } from '@shared/mockup/baseline'
import type { AppConfig, MockupAgence, MockupBrand } from '@shared/mockup/types'
import type { AgencySignature, Brand, GenerationState, GenerationStep, StepStatus } from '@shared/types'
import { runAgent } from './agent'
import { runNode } from './node-runner'
import { PreviewServer } from './preview'
import { type AgentStepKind, agentPrompt } from './prompts'
import { type LoadedTemplate, selectTemplate } from './templates'
import { Workspace } from './workspace'

export interface GeneratorDeps {
  templates: () => LoadedTemplate[]
  workspacesDir: () => string
  agentConfig: () => { enabled: boolean; apiKey?: string; model: string; effort: 'low' | 'medium' | 'high'; maxMinutes: number }
  log: (msg: string, level?: 'info' | 'warn' | 'error' | 'success') => void
  onState: (s: GenerationState) => void
}

export interface PrepareInput {
  brand: Brand
  agence: AgencySignature
  brief: Brief
  siteText?: string
  secteur?: string
}

/** Signature des infos du brief qui changent la maquette (pour savoir s'il faut relancer l'IA). */
export function mockupSignature(b: Brief): string {
  const ids = ['entites', 'modules', 'roles', 'ecrans_prioritaires', 'processus', 'indicateurs', 'acces', 'objectifs']
  return JSON.stringify([b.typeProjet, ...ids.map((id) => [b.champs[id]?.status, b.champs[id]?.valeur, b.champs[id]?.items?.map((i) => [i.nom, i.attributs])])])
}

const STABILITY_MS = 12_000
const MAX_WAIT_MS = 40_000

export class Generator {
  state: GenerationState = { status: 'inactif', agentOwnsApp: false, steps: [] }
  ws?: Workspace
  private preview?: PreviewServer
  private brand?: Brand
  private brief?: Brief
  private secteur?: string
  private running?: Promise<void>
  private pendingTimer?: ReturnType<typeof setTimeout>
  private firstPendingAt = 0
  private lastAgentSignature = ''
  private lastAgentBriefState?: string
  private agentSteps = 0
  private dataStepDone = false
  private stopped = false
  private abort?: AbortController
  /** Échecs consécutifs de l'IA : au-delà de 2, l'IA est coupée pour ce rendez-vous. */
  private agentFailures = 0

  constructor(private deps: GeneratorDeps) {}

  private emit(): void {
    this.deps.onState(structuredClone(this.state))
  }

  private addStep(kind: GenerationStep['kind'], label: string): GenerationStep {
    const step: GenerationStep = { id: `${Date.now()}-${this.state.steps.length}`, kind, label, status: 'en_cours', startedAt: Date.now() }
    this.state.steps.push(step)
    this.emit()
    return step
  }

  private endStep(step: GenerationStep, status: StepStatus, message?: string): void {
    step.status = status
    step.endedAt = Date.now()
    step.message = message && message.length > 320 ? `${message.slice(0, 320)}…` : message
    this.emit()
  }

  // ── 1. Préparation ─────────────────────────────────────────────
  async prepare(input: PrepareInput): Promise<void> {
    this.stopped = false
    this.brand = input.brand
    this.brief = input.brief
    this.secteur = input.secteur
    this.state = { status: 'preparation', agentOwnsApp: false, steps: [] }
    this.emit()
    const step = this.addStep('socle', 'Préparation de la maquette (template + marque)')
    try {
      const template = selectTemplate(this.deps.templates(), input.brief.typeProjet)
      if (!template) throw new Error("Aucun template prêt. Installez les dépendances du template socle (voir README).")
      this.ws = Workspace.create(this.deps.workspacesDir(), slugify(input.brand.nomEntreprise), template)
      this.state.templateId = template.id
      this.state.workspace = this.ws.dir
      this.writeBrandFiles(input)
      this.writeBaseline()
      this.state.planBCommit = this.ws.snapshot('plan-b')
      this.state.lastGoodCommit = this.state.planBCommit
      this.endStep(step, 'ok', `Template « ${template.name} »`)

      const pv = this.addStep('verification', 'Démarrage de la preview')
      this.preview = new PreviewServer(this.ws, (m, l) => this.deps.log(m, l))
      this.state.previewUrl = await this.preview.start()
      this.endStep(pv, 'ok', this.state.previewUrl)
      this.state.status = 'pret'
      this.emit()
      this.deps.log(`Maquette prête : ${this.state.previewUrl}`, 'success')
    } catch (err) {
      for (const s of this.state.steps) if (s.status === 'en_cours') this.endStep(s, 'echec', (err as Error).message)
      this.deps.log(`Préparation de la maquette : ${(err as Error).message}`, 'error')
      this.state.status = 'erreur'
      this.emit()
      throw err
    }
  }

  private writeBrandFiles(input: PrepareInput): void {
    const ws = this.ws!
    // Le dossier des fichiers de marque peut ne pas exister (dossier vide non versionné).
    mkdirSync(ws.path(ws.template.brandAssetsDir), { recursive: true })
    let logo = ''
    if (input.brand.logoPath && existsSync(input.brand.logoPath)) {
      const name = `logo${extname(input.brand.logoPath) || '.png'}`
      copyFileSync(input.brand.logoPath, ws.path(ws.template.brandAssetsDir, name))
      logo = `/brand/${name}`
    }
    const brand: MockupBrand = {
      nomEntreprise: input.brand.nomEntreprise,
      url: input.brand.url,
      logo,
      couleurs: input.brand.couleurs,
      description: input.brand.description,
      ton: input.brand.ton,
      slogan: input.brand.slogan,
      police: input.brand.police
    }
    ws.writeJson('brand.json', brand)
    let agenceLogo = ''
    if (input.agence.logoPath && existsSync(input.agence.logoPath)) {
      const name = `agence${extname(input.agence.logoPath)}`
      copyFileSync(input.agence.logoPath, ws.path(ws.template.brandAssetsDir, name))
      agenceLogo = `/brand/${name}`
    }
    const agence: MockupAgence = { nom: input.agence.nom || 'Votre agence', mention: input.agence.mention || 'Maquette de travail, données fictives', logo: agenceLogo }
    ws.writeJson('agence.json', agence)
    if (input.siteText) writeFileSync(ws.mockupPath('site.txt'), input.siteText, 'utf8')
    ws.writeJson('brief.json', input.brief)
  }

  /** Régénère app.json avec le générateur de base (sans IA). */
  private writeBaseline(): boolean {
    if (!this.ws || !this.brief || !this.brand) return false
    const app: AppConfig = buildAppConfig({ brief: this.brief, nomEntreprise: this.brand.nomEntreprise, secteur: this.secteur, seed: slugify(this.brand.nomEntreprise) })
    const before = JSON.stringify(this.ws.readJson('app.json'))
    if (before === JSON.stringify(app)) return false
    this.ws.writeJson('app.json', app)
    return true
  }

  // ── 2. Pendant l'appel ─────────────────────────────────────────
  onBrief(brief: Brief, secteur?: string): void {
    if (!this.ws || this.stopped) return
    this.brief = brief
    if (secteur) this.secteur = secteur
    this.ws.writeJson('brief.json', brief)
    if (!this.state.agentOwnsApp && !this.running) {
      if (this.writeBaseline()) {
        this.state.lastGoodCommit = this.ws.snapshot('base')
        this.deps.log('Maquette de base mise à jour avec les nouvelles infos du brief')
        this.emit()
      }
    }
    this.scheduleAgent()
  }

  private agentAvailable(): boolean {
    const c = this.deps.agentConfig()
    return c.enabled && !!c.apiKey && this.agentFailures < 2
  }

  private agentFailed(message: string): void {
    this.agentFailures++
    if (this.agentFailures >= 2) {
      this.deps.log(`IA de génération coupée pour ce rendez-vous après 2 échecs (${message}). La maquette de base continue d'être mise à jour.`, 'error')
      if (this.state.agentOwnsApp === false) this.writeBaseline()
    }
  }

  private scheduleAgent(): void {
    if (!this.agentAvailable() || !this.brief) return
    const sig = mockupSignature(this.brief)
    const enough = !!this.brief.typeProjet || (this.brief.champs.entites?.items?.length ?? 0) > 0
    if (!enough || sig === this.lastAgentSignature) return
    const now = Date.now()
    if (!this.pendingTimer) this.firstPendingAt = now
    if (this.pendingTimer) clearTimeout(this.pendingTimer)
    // On attend que le brief soit stable quelques secondes (sans dépasser MAX_WAIT_MS).
    const delay = Math.max(0, Math.min(STABILITY_MS, this.firstPendingAt + MAX_WAIT_MS - now))
    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = undefined
      void this.kick('structure')
    }, delay)
  }

  private async kick(kind: AgentStepKind): Promise<void> {
    if (this.running) {
      // Une étape tourne déjà : on reviendra après.
      await this.running
      if (kind === 'structure') return this.scheduleAgent()
    }
    this.running = this.runAgentStep(kind).finally(() => {
      this.running = undefined
      if (this.stopped || !this.agentAvailable()) return
      if (this.brief && mockupSignature(this.brief) !== this.lastAgentSignature) this.scheduleAgent()
      else if (!this.dataStepDone && this.state.agentOwnsApp && this.state.status !== 'erreur') {
        this.dataStepDone = true
        void this.kick('donnees')
      }
    })
    return this.running
  }

  private async runAgentStep(kind: AgentStepKind): Promise<void> {
    const ws = this.ws
    const cfg = this.deps.agentConfig()
    if (!ws || !this.brief || !this.brand || !cfg.apiKey) return
    const labels: Record<AgentStepKind, string> = {
      structure: this.agentSteps === 0 ? 'IA : maquette sur mesure' : 'IA : intégration des nouvelles infos',
      donnees: 'IA : données réalistes du secteur',
      finition: 'IA : finition avant la démo',
      correction: 'IA : correction'
    }
    const signature = mockupSignature(this.brief)
    const briefState = briefStateForPrompt(this.brief)
    const before = ws.snapshot(`avant-${kind}`)
    const step = this.addStep(kind === 'structure' ? 'structure' : kind === 'donnees' ? 'donnees' : 'finition', labels[kind])
    this.state.status = 'en_cours'
    this.emit()
    this.agentSteps++
    this.abort = new AbortController()
    const minutes = kind === 'structure' && this.agentSteps === 1 ? cfg.maxMinutes : Math.max(2, Math.round(cfg.maxMinutes * 0.6))
    const ctx = { brief: this.brief, brand: this.brand, previousBriefState: this.lastAgentBriefState, stepNumber: this.agentSteps, minutesLeft: minutes }
    const onActivity = (t: string) => {
      this.state.activity = t
      this.emit()
    }
    let res = await runAgent({ apiKey: cfg.apiKey, model: cfg.model, effort: kind === 'finition' ? cfg.effort : cfg.effort === 'high' ? 'medium' : cfg.effort, cwd: ws.dir, prompt: agentPrompt(kind, ctx), timeoutMs: minutes * 60_000, onActivity, signal: this.abort.signal })
    if (this.stopped) return this.endStep(step, 'annule')
    let check = await this.check()
    if (res.filesTouched.length && !check.ok) {
      this.deps.log(`Compilation en échec après l'étape IA, tentative de correction…`, 'warn')
      res = await runAgent({ apiKey: cfg.apiKey, model: cfg.model, effort: 'low', cwd: ws.dir, prompt: agentPrompt('correction', { ...ctx, checkErrors: check.output }), timeoutMs: 120_000, onActivity, signal: this.abort.signal })
      check = await this.check()
    }
    if (!check.ok) {
      ws.restore(before)
      this.endStep(step, 'echec', `Modifications annulées (compilation impossible). ${res.message}`.slice(0, 400))
      this.deps.log('Étape IA annulée : retour à la version précédente de la maquette.', 'warn')
      this.agentFailed('compilation impossible')
    } else if (!res.ok && !res.filesTouched.length) {
      this.endStep(step, 'echec', res.message)
      this.deps.log(res.message, 'error')
      this.agentFailed(res.message)
    } else {
      this.agentFailures = 0
      this.state.lastGoodCommit = ws.snapshot(`ok-${kind}`)
      this.state.agentOwnsApp = true
      this.lastAgentSignature = signature
      this.lastAgentBriefState = briefState
      this.endStep(step, 'ok', `${res.message}${res.costUsd ? ` (≈ ${res.costUsd.toFixed(2)} $)` : ''}`.slice(0, 500))
    }
    this.state.status = 'pret'
    this.state.activity = undefined
    this.emit()
  }

  /** Vérifie que la maquette compile et que app.json est valide. */
  async check(): Promise<{ ok: boolean; output: string }> {
    const ws = this.ws
    if (!ws) return { ok: false, output: 'pas d’espace de travail' }
    const app = ws.readJson<AppConfig>('app.json')
    if (!app || !Array.isArray(app.navigation) || !Array.isArray(app.entites)) return { ok: false, output: 'src/mockup/app.json invalide ou illisible (JSON).' }
    const r = await runNode(ws.template.check.script, ws.template.check.args, ws.dir, 120_000)
    return { ok: r.code === 0, output: r.output }
  }

  // ── 3. Fin d'appel ─────────────────────────────────────────────
  async finalize(): Promise<void> {
    if (!this.ws) return
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer)
      this.pendingTimer = undefined
    }
    if (this.running) await this.running
    if (this.agentAvailable()) {
      // Si l'IA n'a pas encore intégré le dernier brief, on le fait dans la finition.
      this.running = this.runAgentStep('finition')
      await this.running
      this.running = undefined
    } else if (!this.state.agentOwnsApp) {
      this.writeBaseline()
    }
    const step = this.addStep('verification', 'Vérification finale (compilation)')
    const check = await this.check()
    if (check.ok) this.endStep(step, 'ok', 'La maquette compile')
    else {
      this.ws.restore(this.state.lastGoodCommit!)
      this.endStep(step, 'echec', 'Erreur détectée : retour à la dernière version valide')
    }
    this.emit()
  }

  async rollback(target: 'planB' | 'lastGood'): Promise<void> {
    if (!this.ws) return
    this.abort?.abort()
    if (this.running) await this.running.catch(() => {})
    const id = target === 'planB' ? this.state.planBCommit : this.state.lastGoodCommit
    if (!id) return
    this.ws.restore(id)
    const step = this.addStep('retour_arriere', target === 'planB' ? 'Retour au plan B' : 'Retour à la dernière version valide')
    this.endStep(step, 'ok', id)
    if (target === 'planB') this.state.agentOwnsApp = false
  }

  cancelAgent(): void {
    this.abort?.abort()
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.pendingTimer) clearTimeout(this.pendingTimer)
    this.abort?.abort()
    if (this.running) await this.running.catch(() => {})
    this.preview?.stop()
  }

  get workspaceDir(): string | undefined {
    return this.ws?.dir
  }

  get mockupDir(): string | undefined {
    return this.ws ? join(this.ws.dir, this.ws.template.mockupDir) : undefined
  }
}
