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
  workspace?: string
  previewUrl?: string
  lastGoodCommit?: string
  planBCommit?: string
  /** true dès qu'une étape IA a réussi : l'IA est alors propriétaire de app.json. */
  agentOwnsApp: boolean
  steps: GenerationStep[]
  /** Dernière activité de l'agent (fichier modifié, etc.), pour la fenêtre checklist. */
  activity?: string
}

export type SessionPhase = 'accueil' | 'preparation' | 'pret' | 'ecoute' | 'finalisation' | 'termine'

export interface SessionState {
  phase: SessionPhase
  prospect: { nom: string; url: string; notes: string }
  brand?: Brand
  consentementAnnonce: boolean
  startedAt?: number
  transcript: TranscriptSegment[]
  /** Texte provisoire (mode Live) affiché en gris avant validation. */
  interim: Partial<Record<Speaker, string>>
  brief: Brief
  briefStatus: { running: boolean; lastRunAt?: number; lastError?: string; runs: number; rejected: number; provider: string }
  transcription: { mode: TranscriptionMode; status: 'arret' | 'actif' | 'erreur' | 'simulation'; error?: string; levels: Record<Speaker, number> }
  generation: GenerationState
  logs: LogEntry[]
  simulation?: { scenarioId: string; speed: number }
}

export type TranscriptionMode = 'tronçons' | 'live'
export type BriefProvider = 'claude' | 'gemini' | 'scenario'

export interface Settings {
  briefProvider: Exclude<BriefProvider, 'scenario'>
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
}

export interface KeysStatus {
  anthropic: boolean
  gemini: boolean
}

export interface ScenarioInfo {
  id: string
  titre: string
  description: string
  dureeSec: number
}

export interface TemplateInfo {
  id: string
  name: string
  description: string
  projectTypes: string[]
  source: 'integre' | 'agence'
  ready: boolean
  problem?: string
}
