// Chef d'orchestre d'un rendez-vous : préparation → écoute → brief → maquette → finalisation.
// Indépendant d'Electron (testable en ligne de commande, voir scripts/demo-headless.ts).

import { join } from 'node:path'
import { applyPatch, applySiteInfo, defaultQuestions, setManualField } from '@shared/brief/merge'
import { emptyBrief } from '@shared/brief/schema'
import { slugify } from '@shared/mockup/baseline'
import type { Brand, KeysStatus, LogEntry, LogLevel, SessionState, Settings, Speaker, TranscriptSegment } from '@shared/types'
import { claudeSiteAnalyzer, geminiSiteAnalyzer } from './brand/analyze'
import { type ExtractOptions, extractBrand } from './brand/extract'
import { type BriefProviderImpl, ClaudeBriefProvider, GeminiBriefProvider, ScenarioBriefProvider } from './brief/providers'
import { Generator } from './generator/generator'
import { type LoadedTemplate, listTemplates } from './generator/templates'
import { GeminiChunkTranscriber } from './transcription/gemini-chunks'
import { GeminiLiveTranscriber } from './transcription/gemini-live'
import { type Scenario, ScenarioPlayer, loadScenario } from './transcription/scenario'
import type { RawSegment, Transcriber } from './transcription/types'

export interface SessionDeps {
  settings: () => Settings
  keys: () => { anthropic?: string; gemini?: string }
  /** Dossier des templates intégrés. */
  templatesRoot: string
  scenariosRoot: string
  /** Dossier de travail pour la marque (logo, texte du site). */
  dataDir: string
  decodeImage?: ExtractOptions['decodeImage']
  onState: (s: SessionState) => void
}

const MAX_LOGS = 300

export function initialState(): SessionState {
  return {
    phase: 'accueil',
    prospect: { nom: '', url: '', notes: '' },
    consentementAnnonce: false,
    transcript: [],
    interim: {},
    brief: { ...emptyBrief(), questionsSuggerees: defaultQuestions(emptyBrief()) },
    briefStatus: { running: false, runs: 0, rejected: 0, provider: '' },
    transcription: { mode: 'tronçons', status: 'arret', levels: { commercial: 0, prospect: 0 } },
    generation: { status: 'inactif', agentOwnsApp: false, steps: [] },
    logs: []
  }
}

export class Session {
  state: SessionState = initialState()
  private generator: Generator
  private transcriber?: Transcriber
  private player?: ScenarioPlayer
  private scenario?: Scenario
  private briefProvider?: BriefProviderImpl
  private briefTimer?: ReturnType<typeof setInterval>
  private briefRunning?: Promise<void>
  private lastBriefSegmentCount = 0
  private segCounter = 0
  private secteur?: string
  private vocabulaire: string[] = []
  private emitTimer?: ReturnType<typeof setTimeout>
  private briefAbort?: AbortController

  constructor(private deps: SessionDeps) {
    this.generator = new Generator({
      templates: () => this.templates(),
      workspacesDir: () => deps.settings().workspacesDir,
      agentConfig: () => {
        const s = deps.settings()
        return { enabled: s.generation.agentEnabled, apiKey: deps.keys().anthropic, model: s.models.claudeGenerator, effort: s.generatorEffort, maxMinutes: s.generation.maxAgentMinutes }
      },
      log: (m, l) => this.log('generation', m, l ?? 'info'),
      onState: (g) => {
        this.state.generation = g
        this.emit()
      }
    })
  }

  templates(): LoadedTemplate[] {
    return listTemplates(this.deps.templatesRoot, this.deps.settings().templatesDir || undefined)
  }

  keysStatus(): KeysStatus {
    const k = this.deps.keys()
    return { anthropic: !!k.anthropic, gemini: !!k.gemini }
  }

  // ── État et journal ────────────────────────────────────────────
  private emit(now = false): void {
    if (now) {
      if (this.emitTimer) clearTimeout(this.emitTimer)
      this.emitTimer = undefined
      this.deps.onState(this.state)
      return
    }
    if (this.emitTimer) return
    this.emitTimer = setTimeout(() => {
      this.emitTimer = undefined
      this.deps.onState(this.state)
    }, 120)
  }

  log(source: LogEntry['source'], message: string, level: LogLevel = 'info'): void {
    this.state.logs = [...this.state.logs, { at: Date.now(), level, source, message }].slice(-MAX_LOGS)
    this.emit()
  }

  // ── 1. Préparation ─────────────────────────────────────────────
  async prepare(prospect: { nom: string; url: string; notes: string }, scenarioId?: string): Promise<void> {
    await this.reset()
    if (scenarioId) {
      this.scenario = loadScenario(join(this.deps.scenariosRoot, scenarioId))
      prospect = { nom: this.scenario.prospect.nom, url: this.scenario.prospect.url, notes: this.scenario.prospect.notes ?? '' }
      this.state.simulation = { scenarioId, speed: 1 }
    }
    this.state.prospect = prospect
    this.state.phase = 'preparation'
    this.emit(true)

    // Identité visuelle depuis le site.
    let brand: Brand = { nomEntreprise: prospect.nom || 'Prospect', couleurs: { primaire: '#2563eb' }, sources: ['saisie du commercial'] }
    let siteText: string | undefined
    if (prospect.url) {
      this.log('marque', `Analyse du site ${prospect.url}…`)
      try {
        const keys = this.deps.keys()
        const s = this.deps.settings()
        const analyze = keys.anthropic && s.briefProvider === 'claude' ? claudeSiteAnalyzer(keys.anthropic, s.models.claudeBrief) : keys.gemini ? geminiSiteAnalyzer(keys.gemini, s.models.geminiBrief) : keys.anthropic ? claudeSiteAnalyzer(keys.anthropic, s.models.claudeBrief) : undefined
        const res = await extractBrand(prospect.url, {
          destDir: join(this.deps.dataDir, 'marques', slugify(prospect.nom || prospect.url)),
          decodeImage: this.deps.decodeImage,
          analyze,
          log: (m) => this.log('marque', m, 'warn')
        })
        brand = res.brand
        if (prospect.nom) brand.nomEntreprise = prospect.nom
        siteText = res.siteText
        this.secteur = res.secteur
        this.vocabulaire = [brand.nomEntreprise, ...res.vocabulaire]
        this.log('marque', `Identité récupérée : ${brand.nomEntreprise}, couleur principale ${brand.couleurs.primaire}${brand.logoPath ? ', logo trouvé' : ', pas de logo'}`, 'success')
      } catch (err) {
        this.log('marque', `Site inaccessible (${(err as Error).message}) : palette neutre utilisée.`, 'warn')
      }
    }
    this.state.brand = brand
    this.state.brief = applySiteInfo(this.state.brief, {
      url: brand.url ?? prospect.url,
      nom: brand.nomEntreprise,
      identite: brand.url ? `Couleurs ${[brand.couleurs.primaire, brand.couleurs.secondaire].filter(Boolean).join(', ')}${brand.logoPath ? ', logo' : ''}${brand.police ? `, police ${brand.police}` : ''}${brand.ton ? `, ton ${brand.ton}` : ''}` : undefined,
      secteur: this.secteur
    })
    this.state.brief.questionsSuggerees = defaultQuestions(this.state.brief)
    this.emit(true)

    try {
      await this.generator.prepare({ brand, agence: this.deps.settings().agence, brief: this.state.brief, siteText, secteur: this.secteur })
      this.state.phase = 'pret'
    } catch (err) {
      this.log('generation', `Préparation de la maquette impossible : ${(err as Error).message}`, 'error')
      this.state.phase = 'pret'
    }
    this.emit(true)
  }

  // ── 2. Écoute ──────────────────────────────────────────────────
  async startListening(): Promise<void> {
    const s = this.deps.settings()
    const keys = this.deps.keys()
    this.state.startedAt = Date.now()
    this.state.phase = 'ecoute'
    this.lastBriefSegmentCount = 0

    // Fournisseur du brief.
    if (this.scenario && !(s.briefProvider === 'claude' ? keys.anthropic : keys.gemini)) {
      this.briefProvider = new ScenarioBriefProvider(this.scenario)
    } else if (s.briefProvider === 'claude' && keys.anthropic) {
      this.briefProvider = new ClaudeBriefProvider(keys.anthropic, s.models.claudeBrief, s.briefEffort)
    } else if (s.briefProvider === 'gemini' && keys.gemini) {
      this.briefProvider = new GeminiBriefProvider(keys.gemini, s.models.geminiBrief)
    } else if (keys.anthropic) {
      this.briefProvider = new ClaudeBriefProvider(keys.anthropic, s.models.claudeBrief, s.briefEffort)
    } else if (keys.gemini) {
      this.briefProvider = new GeminiBriefProvider(keys.gemini, s.models.geminiBrief)
    } else {
      this.briefProvider = undefined
      this.log('brief', 'Aucune clé API : le brief ne sera pas rempli automatiquement (mode simulation uniquement).', 'warn')
    }
    this.state.briefStatus.provider = this.briefProvider?.name ?? 'aucun'

    // Source du texte : scénario rejoué ou audio réel.
    if (this.scenario) {
      const speed = this.state.simulation?.speed ?? 1
      this.state.transcription = { ...this.state.transcription, status: 'simulation', mode: 'tronçons' }
      this.player = new ScenarioPlayer(this.scenario, speed, (seg) => this.addSegment(seg), () => this.log('session', 'Fin du scénario de démonstration.', 'info'))
      this.player.start()
      this.log('session', `Simulation « ${this.scenario.titre} » (vitesse ×${speed})`)
    } else {
      if (!keys.gemini) {
        this.state.transcription.status = 'erreur'
        this.state.transcription.error = 'Clé Gemini manquante : la transcription est impossible.'
        this.log('transcription', this.state.transcription.error, 'error')
      } else {
        const events = {
          onSegment: (seg: RawSegment) => this.addSegment(seg),
          onInterim: (sp: Speaker, text: string) => {
            this.state.interim = { ...this.state.interim, [sp]: text }
            this.emit()
          },
          onError: (m: string) => this.log('transcription', m, 'error'),
          onInfo: (m: string) => this.log('transcription', m)
        }
        this.transcriber =
          s.transcriptionMode === 'live'
            ? new GeminiLiveTranscriber(keys.gemini, s.models.geminiLive, events)
            : new GeminiChunkTranscriber(keys.gemini, s.models.geminiTranscription, events, this.vocabulaire)
        await this.transcriber.start()
        this.state.transcription = { ...this.state.transcription, mode: s.transcriptionMode, status: 'actif', error: undefined }
        this.log('transcription', `Transcription Gemini active (${s.transcriptionMode === 'live' ? 'mode live' : 'mode tronçons'})`, 'success')
      }
    }

    const interval = (this.scenario ? Math.max(4, s.briefIntervalSec / Math.max(1, this.state.simulation?.speed ?? 1)) : s.briefIntervalSec) * 1000
    this.briefTimer = setInterval(() => void this.runBrief(), interval)
    this.emit(true)
  }

  /** Audio du renderer : un tronçon WAV (mode tronçons). */
  pushChunk(speaker: Speaker, startMs: number, endMs: number, wav: Uint8Array): void {
    this.transcriber?.pushChunk(speaker, startMs, endMs, wav)
  }

  /** Audio du renderer : flux PCM (mode live). */
  pushPcm(speaker: Speaker, pcm: Uint8Array, atMs: number): void {
    this.transcriber?.pushPcm(speaker, pcm, atMs)
  }

  setLevels(levels: Record<Speaker, number>): void {
    this.state.transcription.levels = levels
    this.emit()
  }

  private addSegment(raw: RawSegment): void {
    const seg: TranscriptSegment = { id: `S${++this.segCounter}`, ...raw }
    const list = [...this.state.transcript, seg].sort((a, b) => a.startMs - b.startMs)
    this.state.transcript = list
    this.emit()
  }

  /** Mise à jour du brief (appelée périodiquement). */
  async runBrief(force = false): Promise<void> {
    if (this.briefRunning || !this.briefProvider) return this.briefRunning
    const segments = this.state.transcript
    if (!force && segments.length === this.lastBriefSegmentCount) return
    if (segments.length === 0) return
    const newIds = segments.filter((s) => Number(s.id.slice(1)) > this.lastBriefSegmentCount).map((s) => s.id)
    const count = segments.length
    this.state.briefStatus = { ...this.state.briefStatus, running: true }
    this.emit()
    this.briefAbort = new AbortController()
    this.briefRunning = (async () => {
      try {
        const t0 = Date.now()
        const patch = await this.briefProvider!.update({ brief: this.state.brief, segments, newSegmentIds: newIds }, this.briefAbort!.signal)
        const { brief, report } = applyPatch(this.state.brief, patch, this.state.transcript)
        this.state.brief = brief
        this.lastBriefSegmentCount = count
        this.state.briefStatus = { ...this.state.briefStatus, running: false, lastRunAt: Date.now(), lastError: undefined, runs: this.state.briefStatus.runs + 1, rejected: this.state.briefStatus.rejected + report.rejected.length }
        if (report.accepted.length) this.log('brief', `Brief mis à jour (${report.accepted.join(', ')}) en ${((Date.now() - t0) / 1000).toFixed(1)} s`, 'success')
        for (const r of report.rejected) this.log('brief', `Ignoré : ${r.fieldId} (${r.raison})`, 'warn')
        if (report.typeProjetChange) this.log('brief', `Type de projet identifié : ${brief.typeProjet}`, 'success')
        this.generator.onBrief(brief, this.secteur)
      } catch (err) {
        this.state.briefStatus = { ...this.state.briefStatus, running: false, lastError: (err as Error).message }
        this.log('brief', `Mise à jour du brief impossible : ${(err as Error).message}`, 'error')
      } finally {
        this.briefRunning = undefined
        this.emit()
      }
    })()
    return this.briefRunning
  }

  async stopListening(): Promise<void> {
    if (this.briefTimer) clearInterval(this.briefTimer)
    this.briefTimer = undefined
    this.player?.stop()
    this.player = undefined
    if (this.transcriber) {
      await this.transcriber.stop()
      this.transcriber = undefined
    }
    this.state.transcription = { ...this.state.transcription, status: 'arret', levels: { commercial: 0, prospect: 0 } }
    this.state.interim = {}
    await this.runBrief(true)
    this.emit(true)
  }

  // ── 3. Fin d'appel ─────────────────────────────────────────────
  async finalize(): Promise<void> {
    if (this.state.phase === 'ecoute') await this.stopListening()
    this.state.phase = 'finalisation'
    this.emit(true)
    await this.generator.finalize()
    this.state.phase = 'termine'
    this.log('session', 'Maquette finalisée, prête à être montrée.', 'success')
    this.emit(true)
  }

  setManual(fieldId: string, valeur: string): void {
    this.state.brief = setManualField(this.state.brief, fieldId, valeur)
    this.generator.onBrief(this.state.brief, this.secteur)
    this.emit()
  }

  setConsent(v: boolean): void {
    this.state.consentementAnnonce = v
    this.emit()
  }

  setSimulationSpeed(speed: number): void {
    if (this.state.simulation) this.state.simulation.speed = speed
    this.emit()
  }

  async rollback(target: 'planB' | 'lastGood'): Promise<void> {
    await this.generator.rollback(target)
    this.log('generation', target === 'planB' ? 'Plan B restauré.' : 'Dernière version valide restaurée.', 'warn')
  }

  cancelAgent(): void {
    this.generator.cancelAgent()
  }

  get workspaceDir(): string | undefined {
    return this.generator.workspaceDir
  }

  async reset(): Promise<void> {
    this.briefAbort?.abort()
    if (this.state.phase === 'ecoute') await this.stopListening()
    await this.generator.stop()
    this.scenario = undefined
    this.segCounter = 0
    this.secteur = undefined
    this.vocabulaire = []
    this.state = initialState()
    this.emit(true)
  }

  async dispose(): Promise<void> {
    await this.reset()
  }
}
