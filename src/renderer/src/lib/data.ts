// Accès aux données dans l'interface : état du rendez-vous en direct, rendez-vous enregistrés, réglages.
import { createContext, useContext, useEffect, useState } from 'react'
import type { AppData, KeysStatus, Prospect, Rdv, ScenarioInfo, SessionState, Settings, TemplateInfo } from '@shared/types'

export function useSessionState(): SessionState | undefined {
  const [state, setState] = useState<SessionState>()
  useEffect(() => {
    void window.autobuild.getState().then(setState)
    return window.autobuild.onState(setState)
  }, [])
  return state
}

export function useAppData(): AppData | undefined {
  const [data, setData] = useState<AppData>()
  useEffect(() => {
    void window.autobuild.getData().then(setData)
    return window.autobuild.onData((d) => setData({ ...d }))
  }, [])
  return data
}

export function useSettings(): [Settings | undefined, (s: Settings) => Promise<void>, () => void] {
  const [settings, setSettings] = useState<Settings>()
  const reload = () => void window.autobuild.getSettings().then(setSettings)
  useEffect(reload, [])
  const save = async (s: Settings) => setSettings(await window.autobuild.saveSettings(s))
  return [settings, save, reload]
}

export type Keys = KeysStatus & { chiffrement: boolean }

export function useOnce<T>(load: () => Promise<T>, deps: unknown[] = []): [T | undefined, () => void] {
  const [v, setV] = useState<T>()
  const reload = () => void load().then(setV)
  useEffect(reload, deps)
  return [v, reload]
}

/** Tout ce dont les écrans ont besoin, fourni une fois par l'application. */
export interface Ctx {
  data: AppData
  live: SessionState
  settings: Settings
  saveSettings: (s: Settings) => Promise<void>
  templates: TemplateInfo[]
  scenarios: ScenarioInfo[]
  keys?: Keys
  reloadKeys: () => void
  toast: (msg: string, err?: boolean) => void
}

export const AppContext = createContext<Ctx | null>(null)

export function useApp(): Ctx {
  const c = useContext(AppContext)
  if (!c) throw new Error('AppContext manquant')
  return c
}

// ── Sélecteurs ─────────────────────────────────────────────────
export function prospectOf(data: AppData, rdv: Rdv): Prospect | undefined {
  return data.prospects.find((p) => p.id === rdv.prospectId)
}

export function isUpcoming(r: Rdv): boolean {
  return r.statut !== 'termine'
}

export function upcoming(data: AppData): Rdv[] {
  return data.rdvs.filter(isUpcoming).sort((a, b) => a.debut.localeCompare(b.debut))
}

export function past(data: AppData): Rdv[] {
  return data.rdvs.filter((r) => !isUpcoming(r)).sort((a, b) => (b.startedAt ?? Date.parse(b.debut)) - (a.startedAt ?? Date.parse(a.debut)))
}

/** Prochain rendez-vous à lancer (le plus proche, y compris s'il a commencé il y a peu). */
export function nextRdv(data: AppData): Rdv | undefined {
  const soon = upcoming(data)
  const now = Date.now()
  return soon.find((r) => Date.parse(r.debut) + r.dureeMin * 60_000 > now) ?? soon[soon.length - 1]
}

export function isLive(s: SessionState | undefined): boolean {
  return !!s && (s.phase === 'ecoute' || s.phase === 'finalisation')
}
