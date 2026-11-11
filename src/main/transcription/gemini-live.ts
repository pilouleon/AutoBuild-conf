// Mode B : transcription en continu avec l'API Gemini Live (websocket).
// Une session par canal (commercial / prospect) pour garder la séparation des voix.
// On n'exploite que la transcription de l'audio d'entrée (inputAudioTranscription) ;
// les réponses éventuelles du modèle sont ignorées.
//
// Limites gérées :
//  - une connexion dure ~10 min : le serveur envoie GoAway → on se reconnecte
//    avec le jeton de reprise (sessionResumption) ;
//  - sessions audio limitées à 15 min sans compression → contextWindowCompression.slidingWindow.
//
// Statut : prêt à brancher, à valider avec une vraie clé (voir docs/transcription.md).

import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from '@google/genai'
import type { Speaker } from '@shared/types'
import type { Transcriber, TranscriberEvents } from './types'

interface Channel {
  speaker: Speaker
  session?: Session
  handle?: string
  connecting: boolean
  text: string
  segStartMs: number
  lastAudioMs: number
  lastTextAt: number
  /** Audio reçu pendant une reconnexion. */
  buffer: Uint8Array[]
}

/** Au-delà de ce délai sans nouveau texte, on valide la phrase en cours. */
const COMMIT_IDLE_MS = 1500
const MAX_SEGMENT_CHARS = 400

export class GeminiLiveTranscriber implements Transcriber {
  readonly mode = 'live' as const
  private ai: GoogleGenAI
  private channels: Record<Speaker, Channel>
  private timer?: ReturnType<typeof setInterval>
  private stopped = false

  constructor(
    apiKey: string,
    private model: string,
    private events: TranscriberEvents
  ) {
    this.ai = new GoogleGenAI({ apiKey })
    const mk = (speaker: Speaker): Channel => ({ speaker, connecting: false, text: '', segStartMs: 0, lastAudioMs: 0, lastTextAt: 0, buffer: [] })
    this.channels = { commercial: mk('commercial'), prospect: mk('prospect') }
  }

  async start(): Promise<void> {
    this.stopped = false
    await Promise.all([this.connect(this.channels.commercial), this.connect(this.channels.prospect)])
    this.timer = setInterval(() => this.tick(), 300)
  }

  pushChunk(): void {
    // Non utilisé en mode live.
  }

  pushPcm(speaker: Speaker, pcm: Uint8Array, atMs: number): void {
    const ch = this.channels[speaker]
    ch.lastAudioMs = atMs
    if (!ch.session || ch.connecting) {
      ch.buffer.push(pcm)
      if (ch.buffer.length > 200) ch.buffer.shift() // ~20 s max
      return
    }
    this.send(ch, pcm)
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.timer) clearInterval(this.timer)
    for (const ch of Object.values(this.channels)) {
      this.commit(ch)
      try {
        ch.session?.sendRealtimeInput({ audioStreamEnd: true })
        ch.session?.close()
      } catch {
        /* déjà fermé */
      }
      ch.session = undefined
    }
  }

  private send(ch: Channel, pcm: Uint8Array): void {
    try {
      ch.session!.sendRealtimeInput({ audio: { data: Buffer.from(pcm).toString('base64'), mimeType: 'audio/pcm;rate=16000' } })
    } catch (err) {
      this.events.onError(`Gemini Live (${ch.speaker}) : envoi impossible (${(err as Error).message})`)
    }
  }

  private async connect(ch: Channel): Promise<void> {
    if (this.stopped || ch.connecting) return
    ch.connecting = true
    try {
      ch.session = await this.ai.live.connect({
        model: this.model,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          sessionResumption: ch.handle ? { handle: ch.handle } : {},
          contextWindowCompression: { slidingWindow: {} },
          systemInstruction:
            'Tu es un transcripteur silencieux. Tu ne réponds jamais et tu ne prends jamais la parole. La langue parlée est le français.'
        },
        callbacks: {
          onmessage: (msg) => this.onMessage(ch, msg),
          onerror: (e) => this.events.onError(`Gemini Live (${ch.speaker}) : ${e.message ?? 'erreur websocket'}`),
          onclose: () => {
            ch.session = undefined
            if (!this.stopped) {
              this.events.onInfo?.(`Gemini Live (${ch.speaker}) : reconnexion…`)
              setTimeout(() => void this.connect(ch), 500)
            }
          }
        }
      })
      // On renvoie l'audio reçu pendant la (re)connexion.
      const pending = ch.buffer
      ch.buffer = []
      for (const pcm of pending) this.send(ch, pcm)
    } catch (err) {
      this.events.onError(`Gemini Live (${ch.speaker}) : connexion impossible (${(err as Error).message})`)
      if (!this.stopped) setTimeout(() => void this.connect(ch), 3000)
    } finally {
      ch.connecting = false
    }
  }

  private onMessage(ch: Channel, msg: LiveServerMessage): void {
    if (msg.sessionResumptionUpdate?.resumable && msg.sessionResumptionUpdate.newHandle) {
      ch.handle = msg.sessionResumptionUpdate.newHandle
    }
    if (msg.goAway) {
      // Le serveur va couper : on se reconnecte proprement avec le jeton de reprise.
      const old = ch.session
      ch.session = undefined
      try {
        old?.close()
      } catch {
        /* ignore */
      }
    }
    const tr = msg.serverContent?.inputTranscription
    if (tr?.text) {
      if (!ch.text) ch.segStartMs = Math.max(0, ch.lastAudioMs - 2000)
      ch.text += tr.text
      ch.lastTextAt = Date.now()
      this.events.onInterim?.(ch.speaker, ch.text.trim())
      if (tr.finished || ch.text.length > MAX_SEGMENT_CHARS) this.commit(ch)
    }
  }

  private tick(): void {
    const now = Date.now()
    for (const ch of Object.values(this.channels)) {
      if (ch.text && now - ch.lastTextAt > COMMIT_IDLE_MS) this.commit(ch)
    }
  }

  private commit(ch: Channel): void {
    const text = ch.text.replace(/\s+/g, ' ').trim()
    ch.text = ''
    this.events.onInterim?.(ch.speaker, '')
    if (!text) return
    this.events.onSegment({ speaker: ch.speaker, startMs: ch.segStartMs, endMs: Math.max(ch.segStartMs + 500, ch.lastAudioMs), text })
  }
}
