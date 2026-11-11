import type { KeysStatus, ScenarioInfo, SessionState, Settings, Speaker, TemplateInfo } from '../shared/types'

export interface AutoBuildApi {
  getState(): Promise<SessionState>
  onState(cb: (s: SessionState) => void): () => void

  getSettings(): Promise<Settings>
  saveSettings(s: Settings): Promise<Settings>
  getKeysStatus(): Promise<KeysStatus & { chiffrement: boolean }>
  setKey(name: 'anthropic' | 'gemini', value: string): Promise<KeysStatus & { chiffrement: boolean }>
  testKeys(): Promise<{ anthropic?: string; gemini?: string }>
  testClaudeCode(): Promise<{ ok: boolean; message: string; path?: string }>

  listScenarios(): Promise<ScenarioInfo[]>
  listTemplates(): Promise<TemplateInfo[]>

  prepare(prospect: { nom: string; url: string; notes: string }): Promise<void>
  prepareScenario(id: string, speed: number): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
  finalize(): Promise<void>
  reset(): Promise<void>
  setSpeed(speed: number): Promise<void>
  setBriefMode(rejoue: boolean): Promise<void>
  setConsent(v: boolean): Promise<void>
  setManual(fieldId: string, valeur: string): Promise<void>
  rollback(target: 'planB' | 'lastGood'): Promise<void>
  cancelAgent(): Promise<void>
  runBriefNow(): Promise<void>

  openPreview(): Promise<void>
  openChecklist(): Promise<void>
  openWorkspace(): Promise<void>
  exportBrief(): Promise<string | undefined>
  chooseFolder(title: string): Promise<string | undefined>
  chooseImage(title: string): Promise<string | undefined>

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
