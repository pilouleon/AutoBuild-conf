// Orchestrateur de génération : du brief à la maquette, pendant l'appel.
//
//  1. Préparation (avant l'appel, éventuellement la veille) : copie du template, marque du prospect, version de base,
//     plan B. Au lancement du RDV, la maquette préparée est rouverte (attach) et la preview démarrée.
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
import type { AgencySignature, Brand, GenerationState, GenerationStep, MaquetteVersion, Rdv, StepStatus } from '@shared/types'
import type { ClaudeCli } from '../claude-code/cli'
import { runAgent } from './agent'
import { runNode } from './node-runner'
import { PreviewServer } from './preview'
import { type AgentStepKind, agentPrompt } from './prompts'
import { type LoadedTemplate, sameProject, selectTemplate } from './templates'
import { Workspace } from './workspace'

export interface GeneratorDeps {
  templates: () => LoadedTemplate[]
  workspacesDir: () => string
  agentConfig: () => AgentConfig
  log: (msg: string, level?: 'info' | 'warn' | 'error' | 'success') => void
  onState: (s: GenerationState) => void
}

export interface AgentConfig {
  enabled: boolean
  backend: 'api' | 'claude-code'
  apiKey?: string
  cli?: ClaudeCli
  model: string
  effort: 'low' | 'medium' | 'high'
  maxMinutes: number
}

export interface PrepareInput {
  brand: Brand
  agence: AgencySignature
  brief: Brief
  siteText?: string
  secteur?: string
  /** 'auto' ou id du template imposé. */
  templateChoisi?: string
  /** Type de projet pressenti avant l'appel, pour choisir le template de départ. */
  typeHint?: string | null
  /** Reprise de la maquette d'un RDV précédent (R2). */
  reprise?: { dir: string; templateId?: string }
  /** Nom du dossier de la maquette. */
  nom?: string
}

/** Ce qu'on enregistre d'une maquette dans le rendez-vous. */
export type MaquetteInfo = Rdv['maquette']

export interface AttachContext {
  brand: Brand
  brief: Brief
  secteur?: string
  templateChoisi?: string
}

/** Signature des infos du brief qui changent la maquette (pour savoir s'il faut relancer l'IA). */
export function mockupSignature(b: Brief): string {
  const ids = ['entites', 'modules', 'roles', 'ecrans_prioritaires', 'processus', 'indicateurs', 'acces', 'objectifs']
  return JSON.stringify([b.typeProjet, ...ids.map((id) => [b.champs[id]?.status, b.champs[id]?.valeur, b.champs[id]?.items?.map((i) => [i.nom, i.attributs])])])
}

const STABILITY_MS = 12_000
const MAX_WAIT_MS = 40_000

export class Generator {
  state: GenerationState = { status: 'inactif', agentOwnsApp: false, steps: [], versions: [] }
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
  private templateChoisi = 'auto'

  constructor(private deps: GeneratorDeps) {}

  /** Infos à enregistrer dans le rendez-vous. */
  info(): MaquetteInfo {
    return {
      workspace: this.ws?.dir,
      templateId: this.state.templateId,
      templateName: this.state.templateName,
      planB: this.state.planBCommit,
      lastGood: this.state.lastGoodCommit,
      agentOwnsApp: this.state.agentOwnsApp,
      steps: this.state.steps,
      versions: this.state.versions
    }
  }

  private addVersion(id: string, label: string): void {
    const v: MaquetteVersion = { id, label, at: Date.now() }
    this.state.versions = [...this.state.versions, v]
  }

  private emit(): void {
    this.state.agentDisponible = this.agentAvailable()
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
  /** Crée la maquette de départ (sans preview) : peut être fait bien avant le rendez-vous. */
  async prepare(input: PrepareInput): Promise<MaquetteInfo> {
    this.stopped = false
    this.brand = input.brand
    this.brief = input.brief
    this.secteur = input.secteur
    this.templateChoisi = input.templateChoisi || 'auto'
    this.state = { status: 'preparation', agentOwnsApp: false, steps: [], versions: [] }
    this.emit()
    const step = this.addStep('socle', input.reprise ? 'Reprise de la maquette précédente' : 'Préparation de la maquette (template + marque)')
    try {
      const templates = this.deps.templates()
      const name = input.nom ?? slugify(input.brand.nomEntreprise)
      let template: LoadedTemplate | undefined
      if (input.reprise && existsSync(input.reprise.dir)) {
        template = templates.find((t) => t.id === input.reprise!.templateId) ?? selectTemplate(templates, input.brief.typeProjet ?? input.typeHint ?? null, this.templateChoisi)
        if (!template) throw new Error('Template de la maquette précédente introuvable.')
        this.ws = Workspace.duplicate(this.deps.workspacesDir(), name, input.reprise.dir, template)
        // L'IA avait la main sur la maquette précédente : on garde son travail.
        this.state.agentOwnsApp = true
        this.writeBrandFiles(input)
      } else {
        template = selectTemplate(templates, input.brief.typeProjet ?? input.typeHint ?? null, this.templateChoisi)
        if (!template) throw new Error('Aucun template prêt. Installez les dépendances du template socle (voir README).')
        this.ws = Workspace.create(this.deps.workspacesDir(), name, template)
        this.writeBrandFiles(input)
        this.writeBaseline()
      }
      this.state.templateId = template.id
      this.state.templateName = template.name
      this.state.workspace = this.ws.dir
      this.state.planBCommit = this.ws.snapshot('plan-b')
      this.state.lastGoodCommit = this.state.planBCommit
      this.addVersion(this.state.planBCommit, input.reprise ? 'Maquette du rendez-vous précédent' : 'Maquette de départ (plan B)')
      this.endStep(step, 'ok', `Template « ${template.name} »`)
      this.state.status = 'pret'
      this.emit()
      return this.info()
    } catch (err) {
      for (const s of this.state.steps) if (s.status === 'en_cours') this.endStep(s, 'echec', (err as Error).message)
      this.state.status = 'erreur'
      this.emit()
      throw err
    }
  }

  /** Rouvre une maquette préparée à l'avance (au lancement du rendez-vous). */
  attach(info: MaquetteInfo, ctx: AttachContext): void {
    if (!info.workspace || !existsSync(info.workspace)) throw new Error('Maquette préparée introuvable sur le disque.')
    const templates = this.deps.templates()
    const template = templates.find((t) => t.id === info.templateId) ?? selectTemplate(templates, ctx.brief.typeProjet, ctx.templateChoisi)
    if (!template) throw new Error('Template introuvable.')
    this.stopped = false
    this.ws = Workspace.open(info.workspace, template)
    this.brand = ctx.brand
    this.brief = ctx.brief
    this.secteur = ctx.secteur
    this.templateChoisi = ctx.templateChoisi || 'auto'
    this.agentFailures = 0
    this.agentSteps = 0
    this.dataStepDone = false
    this.lastAgentSignature = ''
    this.state = {
      status: 'pret',
      templateId: template.id,
      templateName: template.name,
      workspace: info.workspace,
      planBCommit: info.planB,
      lastGoodCommit: info.lastGood ?? info.planB,
      agentOwnsApp: !!info.agentOwnsApp,
      steps: [...(info.steps ?? [])],
      versions: [...(info.versions ?? [])]
    }
    this.emit()
  }

  async startPreview(): Promise<string> {
    if (!this.ws) throw new Error('Pas de maquette ouverte.')
    if (this.state.previewUrl && this.preview) return this.state.previewUrl
    const pv = this.addStep('verification', 'Démarrage de la preview')
    try {
      this.preview = new PreviewServer(this.ws, (m, l) => this.deps.log(m, l))
      this.state.previewUrl = await this.preview.start()
      this.endStep(pv, 'ok', this.state.previewUrl)
      this.deps.log(`Maquette prête : ${this.state.previewUrl}`, 'success')
      return this.state.previewUrl
    } catch (err) {
      this.endStep(pv, 'echec', (err as Error).message)
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
    const t = this.ws.template
    const app: AppConfig = buildAppConfig({ brief: this.brief, nomEntreprise: this.brand.nomEntreprise, secteur: this.secteur, seed: slugify(this.brand.nomEntreprise), template: { id: t.id, layout: t.layout, pages: t.pages } })
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
    this.maybeSwitchTemplate()
    if (!this.state.agentOwnsApp && !this.running) {
      if (this.writeBaseline()) {
        this.state.lastGoodCommit = this.ws.snapshot('base')
        this.deps.log('Maquette de base mise à jour avec les nouvelles infos du brief')
        this.emit()
      }
    }
    this.scheduleAgent()
  }

  /**
   * Choix automatique du template : quand le type de projet devient clair pendant l'appel, on passe au template
   * le plus adapté, tant que l'IA n'a pas encore pris la main et que les deux templates partagent le même projet
   * (cas des templates intégrés, qui étendent tous le socle).
   */
  private maybeSwitchTemplate(): void {
    if (!this.ws || !this.brief?.typeProjet || this.templateChoisi !== 'auto' || this.state.agentOwnsApp) return
    const best = selectTemplate(this.deps.templates(), this.brief.typeProjet)
    if (!best || best.id === this.ws.template.id) return
    if (!sameProject(best, this.ws.template)) {
      this.deps.log(`Template « ${best.name} » plus adapté, mais il s'agit d'un autre projet : on garde « ${this.ws.template.name} » pour ce rendez-vous.`)
      return
    }
    this.ws.template = best
    this.state.templateId = best.id
    this.state.templateName = best.name
    this.deps.log(`Template adapté au projet : « ${best.name} »`, 'success')
    this.emit()
  }

  private agentAvailable(): boolean {
    const c = this.deps.agentConfig()
    return c.enabled && (c.backend === 'api' ? !!c.apiKey : !!c.cli) && this.agentFailures < 2
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
    if (!ws || !this.brief || !this.brand || (cfg.backend === 'api' ? !cfg.apiKey : !cfg.cli)) return
    const engine = { backend: cfg.backend, apiKey: cfg.apiKey, cli: cfg.cli, model: cfg.model }
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
    let res = await runAgent({ ...engine, effort: kind === 'finition' ? cfg.effort : cfg.effort === 'high' ? 'medium' : cfg.effort, cwd: ws.dir, prompt: agentPrompt(kind, ctx), timeoutMs: minutes * 60_000, onActivity, signal: this.abort.signal })
    if (this.stopped) return this.endStep(step, 'annule')
    let check = await this.check()
    if (res.filesTouched.length && !check.ok) {
      this.deps.log(`Compilation en échec après l'étape IA, tentative de correction…`, 'warn')
      res = await runAgent({ ...engine, effort: 'low', cwd: ws.dir, prompt: agentPrompt('correction', { ...ctx, checkErrors: check.output }), timeoutMs: 120_000, onActivity, signal: this.abort.signal })
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
      this.addVersion(this.state.lastGoodCommit, labels[kind].replace(/^IA : /, ''))
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
    if (check.ok) {
      this.endStep(step, 'ok', 'La maquette compile')
      this.state.lastGoodCommit = this.ws.snapshot('finale')
      this.addVersion(this.state.lastGoodCommit, 'Version montrée en fin de rendez-vous')
    } else {
      this.ws.restore(this.state.lastGoodCommit!)
      this.endStep(step, 'echec', 'Erreur détectée : retour à la dernière version valide')
    }
    this.emit()
  }

  /** Revient à une version enregistrée (pendant ou après le rendez-vous). */
  async restoreVersion(id: string): Promise<void> {
    if (!this.ws) return
    this.abort?.abort()
    if (this.running) await this.running.catch(() => {})
    this.ws.restore(id)
    this.state.lastGoodCommit = id
    const v = this.state.versions.find((x) => x.id === id)
    const step = this.addStep('retour_arriere', `Retour à « ${v?.label ?? id} »`)
    this.endStep(step, 'ok', id)
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
    this.pendingTimer = undefined
    this.abort?.abort()
    if (this.running) await this.running.catch(() => {})
    this.preview?.stop()
    this.preview = undefined
    this.state.previewUrl = undefined
  }

  get workspaceDir(): string | undefined {
    return this.ws?.dir
  }

  get mockupDir(): string | undefined {
    return this.ws ? join(this.ws.dir, this.ws.template.mockupDir) : undefined
  }
}
