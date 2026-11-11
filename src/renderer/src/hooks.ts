import { useEffect, useState } from 'react'
import type { SessionState, Settings } from '@shared/types'

export function useSessionState(): SessionState | undefined {
  const [state, setState] = useState<SessionState>()
  useEffect(() => {
    void window.autobuild.getState().then(setState)
    return window.autobuild.onState(setState)
  }, [])
  return state
}

/** Réglages courants ; reload() les relit (après le dialogue des réglages). */
export function useSettings(): [Settings | undefined, () => void] {
  const [settings, setSettings] = useState<Settings>()
  const reload = () => void window.autobuild.getSettings().then(setSettings)
  useEffect(reload, [])
  return [settings, reload]
}

export function useElapsed(since?: number): string {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!since) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [since])
  if (!since) return '00:00'
  const s = Math.max(0, Math.floor((now - since) / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
