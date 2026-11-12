// Types partagés entre le processus principal, l'interface et les tests.
// Aucune dépendance à Electron ici : ce dossier doit rester du TypeScript pur.

import type { Brief } from './brief/schema'

/** Canal audio : le micro = le commercial, l'audio système = le prospect. */
export type Speaker = 'commercial' | 'prospect'

export interface TranscriptSegment {
  /** Identifiant court et stable, ex. "S12". Sert de référence pour les preuves du brief. */
  id: string
  speaker: Speaker
  /** Millisecondes depuis le début de l'écoute. */
  startMs: number
  endMs: number
  text: string
}

export interface BrandColors {
  primaire: string
  secondaire?: string
  accent?: string
}

export interface Brand {
  nomEntreprise: string
  url?: string
  /** Chemin local du logo téléchargé (ou data URL). */
  logoPath?: string
  logoUrl?: string
  /** Logo en data URL, pour l'affichage dans l'interface. */
  logoDataUrl?: string
  couleurs: BrandColors
  /** Description courte de l'activité trouvée sur le site. */
  description?: string
  /** Ton de communication (ex. "institutionnel, rassurant"). */
  ton?: string
  slogan?: string
  police?: string
  /** Comment chaque info a été trouvée, pour l'affichage. */
  sources: string[]
}

export interface AgencySignature {
  nom: string
  mention: string
  logoPath?: string
}

export type LogLevel = 'info' | 'warn' | 'error' | 'success'

export interface LogEntry {
  at: number
  level: LogLevel
  source: 'audio' | 'transcription' | 'brief' | 'marque' | 'generation' | 'preview' | 'session'
  message: string
}

export type StepStatus = 'en_attente' | 'en_cours' | 'ok' | 'echec' | 'annule'

export interface GenerationStep {
  id: string
  kind: 'socle' | 'structure' | 'donnees' | 'finition' | 'verification' | 'retour_arriere'
  label: string
  status: StepStatus
  startedAt?: number
  endedAt?: number
  message?: string
  commit?: string
}

export interface GenerationState {
  status: 'inactif' | 'preparation' | 'pret' | 'en_cours' | 'erreur'
  templateId?: string
  templateName?: string
  workspace?: string
  previewUrl?: string
  lastGoodCommit?: string
  planBCommit?: string
  /** true dès qu'une étape IA a réussi : l'IA est alors propriétaire de app.json. */
  agentOwnsApp: boolean
  /** L'IA de génération peut-elle intervenir (activée, accès à Claude, pas coupée après des échecs) ? */
  agentDisponible?: boolean
  steps: GenerationStep[]
  /** Versions enregistrées (plan B, étapes IA réussies, version finale) : on peut revenir à chacune. */
  versions: MaquetteVersion[]
  /** Dernière activité de l'agent (fichier modifié, etc.), pour la fenêtre checklist. */
  activity?: string
}

export type SessionPhase = 'inactif' | 'preparation' | 'pret' | 'ecoute' | 'finalisation' | 'termine'

/** État du rendez-vous en direct (une seule session à la fois). */
export interface SessionState {
  phase: SessionPhase
  rdvId?: string
  prospect: { nom: string; url: string; notes: string }
  brand?: Brand
  consentementAnnonce: boolean
  startedAt?: number
  /** Écoute en pause (le son n'est plus transcrit). */
  pause?: boolean
  transcript: TranscriptSegment[]
  /** Texte provisoire (mode Live) affiché en gris avant validation. */
  interim: Partial<Record<Speaker, string>>
  brief: Brief
  briefStatus: { running: boolean; lastRunAt?: number; lastError?: string; runs: number; rejected: number; provider: string }
  transcription: {
    mode: TranscriptionMode
    status: 'arret' | 'actif' | 'erreur' | 'simulation'
    error?: string
    levels: Record<Speaker, number>
    /** Problème détecté pendant l'écoute (plus de son du prospect, transcription bloquée…). */
    alerte?: string
  }
  generation: GenerationState
  logs: LogEntry[]
  simulation?: { scenarioId: string; speed: number; briefRejoue?: boolean }
}

// ── Données enregistrées sur le poste ────────────────────────────

export interface Contact {
  nom: string
  fonction?: string
  email?: string
}

export interface Prospect {
  id: string
  nom: string
  siteUrl?: string
  secteur?: string
  interlocuteurs: Contact[]
  brand?: Brand
  notes?: string
  creeLe: number
  majLe: number
}

export type RdvStatut = 'a_preparer' | 'preparation' | 'pret' | 'erreur' | 'en_cours' | 'termine'
export type RdvContexte = 'lead' | 'appel_offres' | 'recommandation' | 'client'

export interface PreparationEtape {
  id: 'identite' | 'template' | 'maquette' | 'planb'
  label: string
  statut: 'attente' | 'en_cours' | 'ok' | 'echec'
  detail?: string
}

export interface MaquetteVersion {
  id: string
  label: string
  at: number
}

export interface Rdv {
  id: string
  prospectId: string
  /** « Premier rendez-vous », « Second rendez-vous »… */
  titre: string
  /** Date et heure de début (ISO). */
  debut: string
  dureeMin: number
  lienVisio?: string
  contexte: RdvContexte
  notes: string
  commercial: string
  interlocuteurs: Contact[]
  /** 'auto' : Claude choisit pendant l'appel ; sinon l'id du template imposé. */
  templateChoisi: string
  statut: RdvStatut
  preparation: { etapes: PreparationEtape[]; le?: number; erreur?: string }
  brand?: Brand
  secteur?: string
  vocabulaire?: string[]
  /** Type de projet deviné avant l'appel (notes, site) : sert seulement à choisir le template de départ. */
  typePressenti?: string | null
  brief: Brief
  transcript: TranscriptSegment[]
  startedAt?: number
  endedAt?: number
  maquette: {
    workspace?: string
    templateId?: string
    templateName?: string
    planB?: string
    lastGood?: string
    agentOwnsApp?: boolean
    steps: GenerationStep[]
    versions: MaquetteVersion[]
  }
  /** RDV précédent dont on reprend la maquette (R2…). */
  repriseDe?: string
  /** Démo : scénario rejoué à la place de l'audio. */
  scenarioId?: string
  logs?: LogEntry[]
  creeLe: number
  majLe: number
}

export interface AppData {
  prospects: Prospect[]
  rdvs: Rdv[]
}

export interface NouveauRdvInput {
  prospectId?: string
  prospectNom: string
  siteUrl: string
  debut: string
  dureeMin: number
  lienVisio?: string
  contexte: RdvContexte
  notes: string
  interlocuteurs: Contact[]
  templateChoisi: string
  repriseDe?: string
}

export type TranscriptionMode = 'tronçons' | 'live'
export type BriefProvider = 'claude' | 'gemini' | 'scenario'

export interface Settings {
  briefProvider: Exclude<BriefProvider, 'scenario'>
  /** Comment accéder à Claude : clé API Anthropic, ou Claude Code installé sur le poste (abonnement). */
  claude: { mode: 'api' | 'claude-code'; cliPath: string }
  transcriptionMode: TranscriptionMode
  models: {
    geminiTranscription: string
    geminiLive: string
    geminiBrief: string
    claudeBrief: string
    claudeGenerator: string
  }
  briefEffort: 'low' | 'medium' | 'high'
  generatorEffort: 'low' | 'medium' | 'high'
  briefIntervalSec: number
  audio: {
    micDeviceId: string
    /** 'system' = capture de l'audio système (loopback). Sinon, id d'un périphérique d'entrée (BlackHole, VB-Cable...). */
    prospectSource: string
  }
  agence: AgencySignature
  /** Dossier des templates propres à l'agence (en plus des templates intégrés). */
  templatesDir: string
  workspacesDir: string
  generation: { agentEnabled: boolean; maxAgentMinutes: number }
  profil: { nom: string; fonction: string }
  widget: { bounds?: { x: number; y: number; width: number; height: number } }
}

export interface KeysStatus {
  anthropic: boolean
  gemini: boolean
  /** Claude utilisable (clé API ou Claude Code selon le mode choisi). */
  claude: boolean
  claudeMode: 'api' | 'claude-code'
  claudeCodePath?: string
}

export interface ScenarioInfo {
  id: string
  titre: string
  description: string
  dureeSec: number
}

export interface TemplatePage {
  id: string
  label: string
  description: string
  /** base : toujours présente ; option : activée si le prospect en parle. */
  niveau: 'base' | 'option'
  /** Entité générique (liste, kanban, fiche) ou page sur mesure de la bibliothèque. */
  kind: 'tableau-de-bord' | 'entite' | 'page'
  /** Id de l'entité (préréglage) ou du composant de page. */
  cible?: string
  /** Mots qui déclenchent l'activation de la page. */
  declencheurs: string[]
  icone?: string
}

/** Page de la navigation d'une maquette (lue dans son app.json). */
export interface MaquettePage {
  id: string
  label: string
  icone: string
  origine: 'tableau-de-bord' | 'entite' | 'bibliotheque' | 'sur-mesure'
}

export interface TemplateInfo {
  id: string
  name: string
  description: string
  projectTypes: string[]
  source: 'integre' | 'agence'
  ready: boolean
  problem?: string
  layout?: 'sidebar' | 'topnav'
  couleur?: string
  pages: TemplatePage[]
}
