// Pilote de la capture audio pour le rendez-vous en direct (une seule à la fois, dans la fenêtre principale,
// qui reste active même cachée pendant l'appel).
import type { Settings, Speaker } from '@shared/types'
import { AudioCapture } from './capture'

type Listener = (s: LiveAudioState) => void

export interface LiveAudioState {
  status: 'arret' | 'demarrage' | 'test' | 'envoi' | 'erreur'
  levels: Record<Speaker, number>
  micLabel: string
  hasProspect: boolean
  warnings: string[]
  error?: string
}

let capture: AudioCapture | undefined
let state: LiveAudioState = { status: 'arret', levels: { commercial: 0, prospect: 0 }, micLabel: '', hasProspect: false, warnings: [] }
const listeners = new Set<Listener>()

function set(patch: Partial<LiveAudioState>): void {
  state = { ...state, ...patch }
  listeners.forEach((l) => l(state))
}

export const liveAudio = {
  get state(): LiveAudioState {
    return state
  },
  subscribe(l: Listener): () => void {
    listeners.add(l)
    l(state)
    return () => {
      listeners.delete(l)
    }
  },
  /** Démarre la capture en mode test (niveaux affichés, rien n'est transcrit). */
  async test(s: Settings): Promise<void> {
    if (capture) return
    set({ status: 'demarrage', error: undefined, warnings: [] })
    const c = new AudioCapture()
    capture = c
    try {
      const warnings = await c.start({ micDeviceId: s.audio.micDeviceId, prospectSource: s.audio.prospectSource, mode: s.transcriptionMode, onLevels: (levels) => set({ levels }) })
      if (capture !== c) return void c.stop()
      set({ status: c.sending ? 'envoi' : 'test', micLabel: c.micLabel, hasProspect: c.hasProspect, warnings })
    } catch (err) {
      capture = undefined
      set({ status: 'erreur', error: (err as Error).message })
    }
  },
  /** Le rendez-vous commence : le son part vers la transcription. */
  send(): void {
    if (!capture) return
    capture.sending = true
    set({ status: 'envoi' })
  },
  async stop(): Promise<void> {
    const c = capture
    capture = undefined
    set({ status: 'arret', levels: { commercial: 0, prospect: 0 } })
    await c?.stop()
  }
}
