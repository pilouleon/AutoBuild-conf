import type { AppData, KeysStatus, MaquettePage, NouveauRdvInput, Prospect, Rdv, ScenarioInfo, SessionState, Settings, Speaker, TemplateInfo } from '../shared/types'

export type RdvPatch = Partial<Pick<Rdv, 'debut' | 'dureeMin' | 'lienVisio' | 'contexte' | 'notes' | 'interlocuteurs' | 'templateChoisi'>>
export type ProspectPatch = Partial<Pick<Prospect, 'nom' | 'siteUrl' | 'secteur' | 'notes' | 'interlocuteurs'>>

export interface AutoBuildApi {
  // État du rendez-vous en direct.
  getState(): Promise<SessionState>
  onState(cb: (s: SessionState) => void): () => void
  // Données enregistrées sur le poste (prospects, rendez-vous).
  getData(): Promise<AppData>
  onData(cb: (d: AppData) => void): () => void

  getSettings(): Promise<Settings>
  saveSettings(s: Settings): Promise<Settings>
  getKeysStatus(): Promise<KeysStatus & { chiffrement: boolean }>
  setKey(name: 'anthropic' | 'gemini', value: string): Promise<KeysStatus & { chiffrement: boolean }>
  testKeys(): Promise<{ anthropic?: string; gemini?: string }>
  testClaudeCode(): Promise<{ ok: boolean; message: string; path?: string }>

  listScenarios(): Promise<ScenarioInfo[]>
  listTemplates(): Promise<TemplateInfo[]>

  createRdv(input: NouveauRdvInput): Promise<Rdv>
  createDemoRdv(scenarioId: string): Promise<Rdv>
  updateRdv(id: string, patch: RdvPatch): Promise<Rdv | undefined>
  deleteRdv(id: string): Promise<void>
  prepareRdv(id: string): Promise<void>
  updateProspect(id: string, patch: ProspectPatch): Promise<Prospect | undefined>

  openLive(rdvId: string, speed?: number): Promise<void>
  startLive(): Promise<void>
  pauseLive(v: boolean): Promise<void>
  /** Termine le rendez-vous ; presenter : ouvre ensuite la maquette en plein écran. */
  finishLive(presenter?: boolean): Promise<void>
  closeLive(): Promise<void>
  setSpeed(speed: number): Promise<void>
  setBriefMode(rejoue: boolean): Promise<void>
  setConsent(v: boolean): Promise<void>
  runBriefNow(): Promise<void>
  setManual(rdvId: string, fieldId: string, valeur: string): Promise<void>
  rollback(target: 'planB' | 'lastGood'): Promise<void>
  cancelAgent(): Promise<void>

  showMain(): Promise<void>
  showWidget(): Promise<void>
  hideWidget(): Promise<void>
  setWidgetMode(mode: 'ouvert' | 'reduit'): Promise<void>
  getWidgetMode(): Promise<'ouvert' | 'reduit'>
  onWidgetMode(cb: (mode: 'ouvert' | 'reduit') => void): () => void

  viewMaquette(rdvId: string): Promise<string>
  maquettePages(rdvId: string): Promise<MaquettePage[]>
  presentMaquette(rdvId: string): Promise<void>
  restoreVersion(rdvId: string, versionId: string): Promise<void>
  openMaquetteFolder(rdvId: string): Promise<void>

  exportMarkdown(rdvId: string): Promise<string>
  exportPdf(rdvId: string): Promise<string>
  emailText(rdvId: string): Promise<string>

  chooseFolder(title: string): Promise<string | undefined>
  chooseImage(title: string): Promise<string | undefined>
  openExternal(url: string): Promise<void>

  sendChunk(speaker: Speaker, startMs: number, endMs: number, wav: Uint8Array): void
  sendPcm(speaker: Speaker, pcm: Uint8Array, atMs: number): void
  sendLevels(levels: Record<Speaker, number>): void
  platform: string
}

declare global {
  interface Window {
    autobuild: AutoBuildApi
  }
}
