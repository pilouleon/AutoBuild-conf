// Moteur des rendez-vous : préparation à l'avance, rendez-vous en direct, sauvegarde, maquettes des RDV passés.
// Indépendant d'Electron (testable en ligne de commande, voir scripts/demo-headless.ts).
//
//  - prepareRdv(id) : identité visuelle du prospect + maquette de départ + plan B. Peut être fait la veille.
//  - open(id) → startListening() → finish() → close() : le rendez-vous en direct (un seul à la fois).
//  - Tout est enregistré dans le rendez-vous (transcription, brief, étapes et versions de la maquette).

import { existsSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { applyPatch, applySiteInfo, setManualField } from '@shared/brief/merge'
import { emptyBrief, normalizeBrief } from '@shared/brief/schema'
import { guessProjectType } from '@shared/catalog'
import { slugify } from '@shared/mockup/baseline'
import type { Brand, KeysStatus, LogEntry, LogLevel, NouveauRdvInput, PreparationEtape, Rdv, SessionState, Settings, Speaker, TranscriptSegment } from '@shared/types'
import { claudeCodeSiteAnalyzer, claudeSiteAnalyzer, geminiSiteAnalyzer } from './brand/analyze'
import { type ExtractOptions, extractBrand } from './brand/extract'
import { type BriefProviderImpl, ClaudeBriefProvider, ClaudeCodeBriefProvider, GeminiBriefProvider, ScenarioBriefProvider } from './brief/providers'
import { type ClaudeCli, findClaudeCli } from './claude-code/cli'
import { Generator, type GeneratorDeps } from './generator/generator'
import { PreviewServer } from './generator/preview'
import { type LoadedTemplate, listTemplates, selectTemplate } from './generator/templates'
import { Workspace } from './generator/workspace'
import { type Store, etapesInitiales } from './store'
import { GeminiChunkTranscriber } from './transcription/gemini-chunks'
import { GeminiLiveTranscriber } from './transcription/gemini-live'
import { type Scenario, ScenarioPlayer, loadScenario } from './transcription/scenario'
import type { RawSegment, Transcriber } from './transcription/types'

export interface SessionDeps {
  settings: () => Settings
  keys: () => { anthropic?: string; gemini?: string }
  store: Store
  /** Dossier des templates intégrés. */
  templatesRoot: string
  scenariosRoot: string
  /** Dossier de travail pour la marque (logo, texte du site). */
  dataDir: string
  decodeImage?: ExtractOptions['decodeImage']
  onState: (s: SessionState) => void
}

const MAX_LOGS = 300
/** Niveau audio au-dessus duquel on considère qu'il y a du son. */
const SOUND = 0.02

export function initialState(): SessionState {
  return {
    phase: 'inactif',
    prospect: { nom: '', url: '', notes: '' },
    consentementAnnonce: false,
    transcript: [],
    interim: {},
    brief: emptyBrief(),
    briefStatus: { running: false, runs: 0, rejected: 0, provider: '' },
    transcription: { mode: 'tronçons', status: 'arret', levels: { commercial: 0, prospect: 0 } },
    generation: { status: 'inactif', agentOwnsApp: false, steps: [], versions: [] },
    logs: []
  }
}

export interface Identity {
  brand: Brand
  siteText?: string
  secteur?: string
  vocabulaire: string[]
}

export class Session {
  state: SessionState = initialState()
  private generator: Generator
  private transcriber?: Transcriber
  private player?: ScenarioPlayer
  private scenario?: Scenario
  private briefProvider?: BriefProviderImpl
  private briefTimer?: ReturnType<typeof setInterval>
  private alertTimer?: ReturnType<typeof setInterval>
  private briefRunning?: Promise<void>
  private lastBriefSegmentCount = 0
  private segCounter = 0
  private secteur?: string
  private vocabulaire: string[] = []
  private emitTimer?: ReturnType<typeof setTimeout>
  private briefAbort?: AbortController
  private preparing = new Map<string, Promise<void>>()
  private viewer?: { rdvId: string; preview: PreviewServer; url: string }
  private lastSound: Record<Speaker, number> = { commercial: 0, prospect: 0 }
  private lastSegmentAt = 0

  constructor(private deps: SessionDeps) {
    this.generator = new Generator(this.generatorDeps((g) => {
      this.state.generation = g
      this.emit()
    }, (m, l) => this.log('generation', m, l ?? 'info')))
  }

  private generatorDeps(onState: GeneratorDeps['onState'], log: GeneratorDeps['log']): GeneratorDeps {
    const deps = this.deps
    return {
      templates: () => this.templates(),
      workspacesDir: () => deps.settings().workspacesDir,
      agentConfig: () => {
        const s = deps.settings()
        return {
          enabled: s.generation.agentEnabled,
          backend: s.claude.mode,
          apiKey: deps.keys().anthropic,
          cli: this.cli,
          model: s.models.claudeGenerator,
          effort: s.generatorEffort,
          maxMinutes: s.generation.maxAgentMinutes
        }
      },
      log,
      onState
    }
  }

  templates(): LoadedTemplate[] {
    return listTemplates(this.deps.templatesRoot, this.deps.settings().templatesDir || undefined)
  }

  /** Claude Code installé sur le poste (mode abonnement), détecté à la demande. */
  private cli?: ClaudeCli

  async refreshClaudeCli(): Promise<ClaudeCli | undefined> {
    const s = this.deps.settings()
    this.cli = s.claude.mode === 'claude-code' ? await findClaudeCli(s.claude.cliPath) : undefined
    return this.cli
  }

  /** Accès à Claude selon le mode choisi dans les réglages. */
  private claudeEngine(): { kind: 'api'; key: string } | { kind: 'claude-code'; cli: ClaudeCli } | undefined {
    const s = this.deps.settings()
    if (s.claude.mode === 'claude-code') return this.cli ? { kind: 'claude-code', cli: this.cli } : undefined
    const key = this.deps.keys().anthropic
    return key ? { kind: 'api', key } : undefined
  }

  async keysStatus(): Promise<KeysStatus> {
    const k = this.deps.keys()
    await this.refreshClaudeCli()
    const s = this.deps.settings()
    return { anthropic: !!k.anthropic, gemini: !!k.gemini, claude: !!this.claudeEngine(), claudeMode: s.claude.mode, claudeCodePath: this.cli?.path }
  }

  // ── État et journal ────────────────────────────────────────────
  private emit(now = false): void {
    if (now) {
      if (this.emitTimer) clearTimeout(this.emitTimer)
      this.emitTimer = undefined
      this.flushState()
      return
    }
    if (this.emitTimer) return
    this.emitTimer = setTimeout(() => {
      this.emitTimer = undefined
      this.flushState()
    }, 120)
  }

  private flushState(): void {
    this.persist()
    this.deps.onState(this.state)
  }

  /** Enregistre le rendez-vous en direct (l'écriture sur disque est regroupée par le Store). */
  private persist(): void {
    const id = this.state.rdvId
    if (!id || this.state.phase === 'inactif' || this.state.phase === 'preparation') return
    const s = this.state
    this.deps.store.updateRdv(id, (r) => {
      r.transcript = s.transcript
      r.brief = s.brief
      r.maquette = this.generator.info()
      r.logs = s.logs.slice(-200)
      if (s.startedAt) r.startedAt = s.startedAt
    })
  }

  log(source: LogEntry['source'], message: string, level: LogLevel = 'info'): void {
    this.state.logs = [...this.state.logs, { at: Date.now(), level, source, message }].slice(-MAX_LOGS)
    this.emit()
  }

  // ── 1. Préparation (à l'avance) ────────────────────────────────
  createRdv(input: NouveauRdvInput, extra: Partial<Rdv> = {}): Rdv {
    return this.deps.store.createRdv(input, this.deps.settings().profil.nom || 'Commercial', extra)
  }

  /** Rendez-vous de démonstration : un faux R1 rejoué, prêt à être lancé tout de suite. */
  createDemoRdv(scenarioId: string, templateChoisi = 'auto'): Rdv {
    const sc = loadScenario(join(this.deps.scenariosRoot, scenarioId))
    const debut = new Date(Date.now() + 5 * 60_000)
    debut.setSeconds(0, 0)
    return this.createRdv(
      {
        prospectNom: sc.prospect.nom,
        siteUrl: '',
        debut: debut.toISOString(),
        dureeMin: 30,
        contexte: 'lead',
        notes: `${sc.prospect.notes ?? ''}\nRendez-vous de démonstration : la conversation est rejouée, sans micro.`.trim(),
        interlocuteurs: sc.interlocuteurs ?? [],
        templateChoisi
      },
      { scenarioId }
    )
  }

  /** Prépare un rendez-vous (identité, template, maquette de départ, plan B). Sans effet s'il est déjà en cours de préparation. */
  prepareRdv(rdvId: string): Promise<void> {
    const running = this.preparing.get(rdvId)
    if (running) return running
    const p = this.doPrepare(rdvId).finally(() => this.preparing.delete(rdvId))
    this.preparing.set(rdvId, p)
    return p
  }

  isPreparing(rdvId: string): boolean {
    return this.preparing.has(rdvId)
  }

  private async doPrepare(rdvId: string): Promise<void> {
    const store = this.deps.store
    const rdv = store.rdv(rdvId)
    if (!rdv) throw new Error('Rendez-vous introuvable.')
    const prospect = store.prospect(rdv.prospectId)
    if (!prospect) throw new Error('Prospect introuvable.')
    const logs: LogEntry[] = []
    const log = (source: LogEntry['source'], message: string, level: LogLevel = 'info') => {
      logs.push({ at: Date.now(), level, source, message })
      store.updateRdv(rdvId, (r) => (r.logs = [...(r.logs ?? []), ...logs.splice(0)].slice(-200)))
    }
    const etape = (id: PreparationEtape['id'], statut: PreparationEtape['statut'], detail?: string) =>
      store.updateRdv(rdvId, (r) => {
        const e = r.preparation.etapes.find((x) => x.id === id)
        if (e) Object.assign(e, { statut, detail })
      })
    store.updateRdv(rdvId, (r) => {
      r.statut = 'preparation'
      r.preparation = { etapes: etapesInitiales() }
    })
    store.save(true)
    const previous = rdv.repriseDe ? store.rdv(rdv.repriseDe) : undefined
    try {
      // 1. Identité visuelle (site du prospect, ou celui du scénario de démo).
      etape('identite', 'en_cours')
      let url = prospect.siteUrl ?? ''
      if (rdv.scenarioId) url = loadScenario(join(this.deps.scenariosRoot, rdv.scenarioId)).prospect.url
      const id = await this.extractIdentity(prospect.nom, url, (m, l) => log('marque', m, l))
      etape('identite', 'ok', url ? `${id.brand.couleurs.primaire}${id.brand.logoPath ? ' · logo trouvé' : ' · pas de logo'}${id.secteur ? ` · ${id.secteur}` : ''}` : 'Pas de site : palette neutre')
      store.updateProspect(prospect.id, (p) => {
        p.brand = id.brand
        if (id.secteur && !p.secteur) p.secteur = id.secteur
      })

      // Brief de départ : celui du rendez-vous précédent (reprise) ou vide, complété par le site.
      let brief = previous ? normalizeBrief(structuredClone(previous.brief)) : emptyBrief()
      if (id.brand.url) brief = applySiteInfo(brief, siteInfo(id))
      else brief = setManualField(brief, 'entreprise_nom', prospect.nom)
      const typePressenti = brief.typeProjet ?? guessProjectType(`${rdv.notes}\n${id.siteText ?? ''}`.slice(0, 30_000))

      // 2-4. Template, maquette de départ, plan B.
      etape('template', 'en_cours')
      const gen = new Generator(this.generatorDeps(() => {}, (m, l) => log('generation', m, l ?? 'info')))
      const info = await gen.prepare({
        brand: id.brand,
        agence: this.deps.settings().agence,
        brief,
        siteText: id.siteText,
        secteur: id.secteur,
        templateChoisi: rdv.templateChoisi,
        typeHint: typePressenti,
        reprise: previous?.maquette.workspace ? { dir: previous.maquette.workspace, templateId: previous.maquette.templateId } : undefined,
        nom: slugify(prospect.nom)
      })
      etape('template', 'ok', info.templateName)
      etape('maquette', 'ok', previous ? 'Reprise de la maquette précédente' : 'Version de base générée')
      etape('planb', 'ok', 'Enregistré : retour possible à tout moment')
      store.updateRdv(rdvId, (r) => {
        r.brand = id.brand
        r.secteur = id.secteur
        r.vocabulaire = id.vocabulaire
        r.typePressenti = typePressenti
        r.brief = brief
        r.maquette = info
        r.statut = 'pret'
        r.preparation.le = Date.now()
        r.preparation.erreur = undefined
      })
      log('session', 'Rendez-vous prêt.', 'success')
    } catch (err) {
      const msg = (err as Error).message
      store.updateRdv(rdvId, (r) => {
        r.statut = 'erreur'
        r.preparation.erreur = msg
        for (const e of r.preparation.etapes) if (e.statut === 'en_cours') Object.assign(e, { statut: 'echec', detail: msg })
      })
      log('session', `Préparation impossible : ${msg}`, 'error')
      throw err
    } finally {
      store.save(true)
    }
  }

  /** Identité visuelle depuis le site du prospect (logo, couleurs, ton, secteur, vocabulaire). */
  async extractIdentity(nom: string, url: string, log: (m: string, l: LogLevel) => void): Promise<Identity> {
    let brand: Brand = { nomEntreprise: nom || 'Prospect', couleurs: { primaire: '#2563eb' }, sources: ['saisie du commercial'] }
    let siteText: string | undefined
    let secteur: string | undefined
    let vocabulaire: string[] = [brand.nomEntreprise]
    if (url) {
      log(`Analyse du site ${url}…`, 'info')
      try {
        const keys = this.deps.keys()
        const s = this.deps.settings()
        await this.refreshClaudeCli()
        const claude = this.claudeEngine()
        const claudeAnalyzer = claude?.kind === 'api' ? claudeSiteAnalyzer(claude.key, s.models.claudeBrief) : claude ? claudeCodeSiteAnalyzer(claude.cli, s.models.claudeBrief, this.deps.dataDir) : undefined
        const geminiAnalyzer = keys.gemini ? geminiSiteAnalyzer(keys.gemini, s.models.geminiBrief) : undefined
        const analyze = s.briefProvider === 'claude' ? (claudeAnalyzer ?? geminiAnalyzer) : (geminiAnalyzer ?? claudeAnalyzer)
        const res = await extractBrand(url, {
          destDir: join(this.deps.dataDir, 'marques', slugify(nom || url)),
          decodeImage: this.deps.decodeImage,
          analyze,
          log: (m) => log(m, 'warn')
        })
        brand = res.brand
        if (nom) brand.nomEntreprise = nom
        siteText = res.siteText
        secteur = res.secteur
        vocabulaire = [brand.nomEntreprise, ...res.vocabulaire]
        log(`Identité récupérée : ${brand.nomEntreprise}, couleur principale ${brand.couleurs.primaire}${brand.logoPath ? ', logo trouvé' : ', pas de logo'}`, 'success')
      } catch (err) {
        log(`Site inaccessible (${(err as Error).message}) : palette neutre utilisée.`, 'warn')
      }
    }
    if (brand.logoPath) {
      try {
        const bytes = readFileSync(brand.logoPath)
        if (bytes.length < 400_000) {
          const ext = extname(brand.logoPath).slice(1).toLowerCase()
          const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : ext === 'ico' ? 'image/x-icon' : `image/${ext}`
          brand.logoDataUrl = `data:${mime};base64,${bytes.toString('base64')}`
        }
      } catch {
        /* logo illisible */
      }
    }
    return { brand, siteText, secteur, vocabulaire }
  }

  // ── 2. Rendez-vous en direct ───────────────────────────────────
  /** Ouvre un rendez-vous pour le direct : préparation si besoin, maquette rouverte, preview démarrée. */
  async open(rdvId: string, opts: { speed?: number } = {}): Promise<void> {
    const live = this.state.phase !== 'inactif' && this.state.phase !== 'termine'
    if (live && this.state.rdvId === rdvId) return
    if (live) throw new Error('Un autre rendez-vous est en cours : terminez-le avant d’en lancer un nouveau.')
    await this.close()
    const store = this.deps.store
    let rdv = store.rdv(rdvId)
    if (!rdv) throw new Error('Rendez-vous introuvable.')
    const prospect = store.prospect(rdv.prospectId)
    this.state.rdvId = rdvId
    this.state.phase = 'preparation'
    this.state.prospect = { nom: prospect?.nom ?? '', url: prospect?.siteUrl ?? '', notes: rdv.notes }
    this.emit(true)

    const prepared = rdv.statut !== 'a_preparer' && rdv.statut !== 'erreur' && !!rdv.maquette.workspace && existsSync(rdv.maquette.workspace)
    if (this.preparing.has(rdvId) || !prepared) {
      this.log('session', 'Préparation du rendez-vous…')
      try {
        await this.prepareRdv(rdvId)
      } catch (err) {
        this.state.phase = 'inactif'
        this.state.rdvId = undefined
        this.emit(true)
        throw err
      }
      rdv = store.rdv(rdvId)!
    }
    if (rdv.scenarioId) {
      this.scenario = loadScenario(join(this.deps.scenariosRoot, rdv.scenarioId))
      this.state.simulation = { scenarioId: rdv.scenarioId, speed: opts.speed ?? 1 }
    }
    this.secteur = rdv.secteur
    this.vocabulaire = rdv.vocabulaire ?? [this.state.prospect.nom]
    this.state.brand = rdv.brand
    this.state.brief = normalizeBrief(rdv.brief)
    this.state.transcript = rdv.transcript ?? []
    this.segCounter = this.state.transcript.length
    this.generator.attach(rdv.maquette, { brand: rdv.brand ?? { nomEntreprise: this.state.prospect.nom, couleurs: { primaire: '#2563eb' }, sources: [] }, brief: this.state.brief, secteur: rdv.secteur, templateChoisi: rdv.templateChoisi })
    try {
      await this.generator.startPreview()
    } catch (err) {
      this.log('preview', `La maquette ne peut pas être affichée : ${(err as Error).message}`, 'error')
    }
    this.state.phase = 'pret'
    this.emit(true)
  }

  async startListening(): Promise<void> {
    if (this.state.phase !== 'pret') throw new Error('Le rendez-vous n’est pas prêt.')
    const s = this.deps.settings()
    const keys = this.deps.keys()
    this.state.startedAt = Date.now()
    this.state.phase = 'ecoute'
    this.state.pause = false
    this.lastBriefSegmentCount = this.state.transcript.length
    this.lastSound = { commercial: Date.now(), prospect: Date.now() }
    this.lastSegmentAt = Date.now()
    if (this.state.rdvId)
      this.deps.store.updateRdv(this.state.rdvId, (r) => {
        r.statut = 'en_cours'
        r.startedAt = this.state.startedAt
      })

    // Fournisseur du brief : celui choisi, sinon l'autre, sinon (démo) les patchs rejoués du scénario.
    await this.refreshClaudeCli()
    const claude = this.claudeEngine()
    const claudeProvider = claude?.kind === 'api' ? new ClaudeBriefProvider(claude.key, s.models.claudeBrief, s.briefEffort) : claude ? new ClaudeCodeBriefProvider(claude.cli, s.models.claudeBrief, s.briefEffort, this.deps.dataDir) : undefined
    const geminiProvider = keys.gemini ? new GeminiBriefProvider(keys.gemini, s.models.geminiBrief) : undefined
    const chosen = s.briefProvider === 'claude' ? claudeProvider : geminiProvider
    if (this.scenario && (!chosen || this.state.simulation?.briefRejoue)) {
      this.briefProvider = new ScenarioBriefProvider(this.scenario)
    } else {
      this.briefProvider = chosen ?? claudeProvider ?? geminiProvider
    }
    if (!this.briefProvider) this.log('brief', 'Aucun accès à Claude ni à Gemini : le brief ne sera pas rempli automatiquement (seule la démo rejouée fonctionne sans IA).', 'warn')
    this.state.briefStatus.provider = this.briefProvider?.name ?? 'aucun'

    // Source du texte : scénario rejoué ou audio réel.
    if (this.scenario) {
      const speed = this.state.simulation?.speed ?? 1
      this.state.transcription = { ...this.state.transcription, status: 'simulation', mode: 'tronçons' }
      this.player = new ScenarioPlayer(this.scenario, speed, (seg) => this.addSegment(seg), () => this.log('session', 'Fin de la conversation de démonstration.', 'info'))
      this.player.start()
      this.log('session', `Démonstration « ${this.scenario.titre} » (vitesse ×${speed})`)
    } else if (process.env.AUTOBUILD_TRANSCRIPTION_TEST === '1') {
      // Test de la chaîne audio sans clé : chaque tronçon reçu devient un segment « technique ».
      this.transcriber = {
        mode: 'tronçons',
        start: async () => {},
        stop: async () => {},
        pushPcm: () => {},
        pushChunk: (speaker, startMs, endMs, wav) => this.addSegment({ speaker, startMs, endMs, text: `[test] tronçon audio reçu : ${((endMs - startMs) / 1000).toFixed(1)} s, ${wav.length} octets` })
      }
      this.state.transcription = { ...this.state.transcription, mode: 'tronçons', status: 'actif', error: undefined }
      this.log('transcription', 'Mode test de la chaîne audio (AUTOBUILD_TRANSCRIPTION_TEST)', 'warn')
    } else if (!keys.gemini) {
      this.state.transcription.status = 'erreur'
      this.state.transcription.error = 'Clé Gemini manquante : la transcription est impossible.'
      this.state.transcription.alerte = this.state.transcription.error
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
      try {
        await this.transcriber.start()
        this.state.transcription = { ...this.state.transcription, mode: s.transcriptionMode, status: 'actif', error: undefined }
        this.log('transcription', `Transcription Gemini active (${s.transcriptionMode === 'live' ? 'mode live' : 'mode tronçons'})`, 'success')
      } catch (err) {
        this.state.transcription = { ...this.state.transcription, status: 'erreur', error: (err as Error).message, alerte: `Transcription impossible : ${(err as Error).message}` }
        this.log('transcription', `Transcription impossible : ${(err as Error).message}`, 'error')
      }
    }

    const interval = (this.scenario ? Math.max(4, s.briefIntervalSec / Math.max(1, this.state.simulation?.speed ?? 1)) : s.briefIntervalSec) * 1000
    this.briefTimer = setInterval(() => void this.runBrief(), interval)
    this.alertTimer = setInterval(() => this.checkAlerts(), 3000)
    this.emit(true)
  }

  /** Audio du renderer : un tronçon WAV (mode tronçons). */
  pushChunk(speaker: Speaker, startMs: number, endMs: number, wav: Uint8Array): void {
    if (this.state.pause || this.state.phase !== 'ecoute') return
    this.transcriber?.pushChunk(speaker, startMs, endMs, wav)
  }

  /** Audio du renderer : flux PCM (mode live). */
  pushPcm(speaker: Speaker, pcm: Uint8Array, atMs: number): void {
    if (this.state.pause || this.state.phase !== 'ecoute') return
    this.transcriber?.pushPcm(speaker, pcm, atMs)
  }

  setLevels(levels: Record<Speaker, number>): void {
    this.state.transcription.levels = levels
    const now = Date.now()
    for (const sp of ['commercial', 'prospect'] as Speaker[]) if ((levels[sp] ?? 0) > SOUND) this.lastSound[sp] = now
    this.emit()
  }

  /** Détecte les problèmes pendant l'écoute et les affiche dans le widget. */
  private checkAlerts(): void {
    const t = this.state.transcription
    if (this.state.phase !== 'ecoute' || this.state.pause || this.scenario) {
      if (t.alerte && t.status !== 'erreur') this.setAlert(undefined)
      return
    }
    const now = Date.now()
    let alerte: string | undefined
    if (t.status === 'erreur') alerte = t.error ?? 'La transcription est en erreur.'
    else if (now - this.lastSound.prospect > 30_000) alerte = 'Aucun son du prospect depuis 30 s : vérifiez que le son de la visio sort bien sur cet ordinateur.'
    else if (now - this.lastSound.commercial > 45_000) alerte = 'Votre micro ne capte rien depuis 45 s : vérifiez qu’il n’est pas coupé.'
    else if (now - this.lastSegmentAt > 75_000 && now - Math.max(this.lastSound.prospect, this.lastSound.commercial) < 10_000) alerte = 'La transcription ne renvoie plus de texte depuis plus d’une minute.'
    if (alerte !== t.alerte) this.setAlert(alerte)
  }

  private setAlert(alerte: string | undefined): void {
    if (alerte && alerte !== this.state.transcription.alerte) this.log('audio', alerte, 'warn')
    this.state.transcription = { ...this.state.transcription, alerte }
    this.emit()
  }

  setPause(pause: boolean): void {
    if (this.state.phase !== 'ecoute') return
    this.state.pause = pause
    this.state.interim = {}
    this.log('session', pause ? 'Écoute en pause : ce qui est dit n’est plus transcrit.' : 'Écoute reprise.', pause ? 'warn' : 'info')
    if (!pause) {
      this.lastSound = { commercial: Date.now(), prospect: Date.now() }
      this.lastSegmentAt = Date.now()
    }
    this.emit(true)
  }

  private addSegment(raw: RawSegment): void {
    if (this.state.pause) return
    this.lastSegmentAt = Date.now()
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
        if (report.champsAjoutes.length) this.log('brief', `Nouvelles infos à obtenir : ${report.champsAjoutes.join(', ')}`, 'info')
        for (const r of report.rejected) this.log('brief', `Ignoré : ${r.fieldId} (${r.raison})`, 'warn')
        if (report.typeProjetChange) this.log('brief', `Type de projet identifié : ${brief.typeProjet}`, 'success')
        this.generator.onBrief(brief, this.secteur)
      } catch (err) {
        this.state.briefStatus = { ...this.state.briefStatus, running: false, lastError: (err as Error).message }
        if (!this.briefAbort?.signal.aborted) this.log('brief', `Mise à jour du brief impossible : ${(err as Error).message}`, 'error')
      } finally {
        this.briefRunning = undefined
        this.emit()
      }
    })()
    return this.briefRunning
  }

  private async stopListening(): Promise<void> {
    if (this.briefTimer) clearInterval(this.briefTimer)
    if (this.alertTimer) clearInterval(this.alertTimer)
    this.briefTimer = undefined
    this.alertTimer = undefined
    this.player?.stop()
    this.player = undefined
    if (this.transcriber) {
      await this.transcriber.stop().catch(() => {})
      this.transcriber = undefined
    }
    this.state.transcription = { ...this.state.transcription, status: 'arret', levels: { commercial: 0, prospect: 0 }, alerte: undefined }
    this.state.interim = {}
    this.state.pause = false
  }

  /** Fin de l'appel : dernière mise à jour du brief, finition de la maquette, enregistrement. */
  async finish(): Promise<void> {
    if (this.state.phase !== 'ecoute' && this.state.phase !== 'pret') return
    const wasListening = this.state.phase === 'ecoute'
    this.state.phase = 'finalisation'
    this.emit(true)
    if (wasListening) {
      await this.stopListening()
      await this.runBrief(true)
    }
    await this.generator.finalize()
    this.state.phase = 'termine'
    this.log('session', 'Maquette finalisée, prête à être montrée.', 'success')
    this.persist()
    if (this.state.rdvId)
      this.deps.store.updateRdv(this.state.rdvId, (r) => {
        r.statut = wasListening || r.transcript.length ? 'termine' : 'pret'
        r.endedAt = Date.now()
      })
    this.deps.store.save(true)
    this.emit(true)
  }

  /** Ferme le rendez-vous en direct (la preview s'arrête). */
  async close(): Promise<void> {
    this.briefAbort?.abort()
    if (this.state.phase === 'ecoute') {
      await this.stopListening()
      if (this.state.rdvId)
        this.deps.store.updateRdv(this.state.rdvId, (r) => {
          r.statut = r.transcript.length ? 'termine' : 'pret'
          r.endedAt = Date.now()
        })
    }
    if (this.state.rdvId && this.state.phase !== 'inactif') this.persist()
    await this.generator.stop()
    this.scenario = undefined
    this.segCounter = 0
    this.secteur = undefined
    this.vocabulaire = []
    this.state = initialState()
    this.deps.store.save(true)
    this.emit(true)
  }

  setManual(fieldId: string, valeur: string): void {
    this.state.brief = setManualField(this.state.brief, fieldId, valeur)
    this.generator.onBrief(this.state.brief, this.secteur)
    this.emit()
  }

  /** Complète le brief d'un rendez-vous (en direct ou passé). */
  setManualRdv(rdvId: string, fieldId: string, valeur: string): void {
    if (this.state.rdvId === rdvId && this.state.phase !== 'inactif') return this.setManual(fieldId, valeur)
    this.deps.store.updateRdv(rdvId, (r) => (r.brief = setManualField(r.brief, fieldId, valeur)))
  }

  setConsent(v: boolean): void {
    this.state.consentementAnnonce = v
    this.emit()
  }

  setSimulationSpeed(speed: number): void {
    if (this.state.simulation) this.state.simulation.speed = speed
    this.emit()
  }

  /** Démo : brief rejoué (instantané, sans IA) ou rempli par l'IA disponible. */
  setSimulationBriefMode(rejoue: boolean): void {
    if (this.state.simulation) this.state.simulation.briefRejoue = rejoue
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

  // ── 3. Maquettes des rendez-vous passés ────────────────────────
  private templateFor(rdv: Rdv): LoadedTemplate | undefined {
    const all = this.templates()
    return all.find((t) => t.id === rdv.maquette.templateId) ?? selectTemplate(all, rdv.brief.typeProjet)
  }

  /** Démarre la preview de la maquette d'un rendez-vous (celle du direct si c'est le RDV en cours). */
  async viewMaquette(rdvId: string): Promise<string> {
    if (this.state.rdvId === rdvId && this.state.generation.previewUrl) return this.state.generation.previewUrl
    if (this.viewer?.rdvId === rdvId) return this.viewer.url
    this.stopViewer()
    const rdv = this.deps.store.rdv(rdvId)
    if (!rdv?.maquette.workspace || !existsSync(rdv.maquette.workspace)) throw new Error('Cette maquette n’existe plus sur ce poste.')
    const template = this.templateFor(rdv)
    if (!template) throw new Error('Template de la maquette introuvable.')
    const preview = new PreviewServer(Workspace.open(rdv.maquette.workspace, template), (m) => this.log('preview', m, 'warn'))
    const url = await preview.start()
    this.viewer = { rdvId, preview, url }
    return url
  }

  stopViewer(): void {
    this.viewer?.preview.stop()
    this.viewer = undefined
  }

  /** Revient à une version de la maquette d'un rendez-vous. */
  async restoreVersion(rdvId: string, versionId: string): Promise<void> {
    if (this.state.rdvId === rdvId && this.state.phase !== 'inactif') {
      await this.generator.restoreVersion(versionId)
      return
    }
    const rdv = this.deps.store.rdv(rdvId)
    if (!rdv?.maquette.workspace) throw new Error('Maquette introuvable.')
    const template = this.templateFor(rdv)
    if (!template) throw new Error('Template introuvable.')
    Workspace.open(rdv.maquette.workspace, template).restore(versionId)
    const v = rdv.maquette.versions.find((x) => x.id === versionId)
    this.deps.store.updateRdv(rdvId, (r) => {
      r.maquette.lastGood = versionId
      r.maquette.steps = [...r.maquette.steps, { id: `${Date.now()}`, kind: 'retour_arriere', label: `Retour à « ${v?.label ?? versionId} »`, status: 'ok', startedAt: Date.now(), endedAt: Date.now() }]
    })
  }

  async dispose(): Promise<void> {
    this.stopViewer()
    await this.close()
    this.deps.store.flush()
  }
}

function siteInfo(id: Identity): { url: string; nom: string; identite: string; secteur?: string } {
  const b = id.brand
  return {
    url: b.url ?? '',
    nom: b.nomEntreprise,
    identite: `Couleurs ${[b.couleurs.primaire, b.couleurs.secondaire].filter(Boolean).join(', ')}${b.logoPath ? ', logo' : ''}${b.police ? `, police ${b.police}` : ''}${b.ton ? `, ton ${b.ton}` : ''}`,
    secteur: id.secteur
  }
}
