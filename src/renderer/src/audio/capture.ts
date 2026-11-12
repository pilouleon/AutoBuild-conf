// Capture audio 2 canaux dans le renderer :
//   - micro            → commercial
//   - audio système    → prospect (loopback via getDisplayMedia), ou un périphérique d'entrée
//                        virtuel choisi dans les réglages (BlackHole, VB-Cable…)
// Le son est rééchantillonné en 16 kHz mono, découpé sur les silences (mode tronçons)
// ou envoyé en continu (mode live).

import { VadChunker, encodeWav, floatToPcm16 } from '@shared/audio/chunker'
import type { Speaker, TranscriptionMode } from '@shared/types'

const SAMPLE_RATE = 16000

const WORKLET = `
class PcmCapture extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(1600); this.n = 0 }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i]
        if (this.n === this.buf.length) { this.port.postMessage(this.buf.slice(0)); this.n = 0 }
      }
    }
    return true
  }
}
registerProcessor('pcm-capture', PcmCapture)
`

interface Channel {
  speaker: Speaker
  stream: MediaStream
  node?: AudioWorkletNode
  chunker: VadChunker
  samples: number
  level: number
}

export interface CaptureOptions {
  micDeviceId: string
  prospectSource: string
  mode: TranscriptionMode
  /** Niveaux (0 à 1) pour l'affichage local, toutes les 200 ms. */
  onLevels?: (levels: Record<Speaker, number>) => void
}

export class AudioCapture {
  /** false : test du son avant le rendez-vous (rien n'est envoyé à la transcription). */
  sending = false
  /** Libellé du micro utilisé. */
  micLabel = ''
  hasProspect = false
  private ctx?: AudioContext
  private channels: Channel[] = []
  private levelTimer?: ReturnType<typeof setInterval>

  async start(o: CaptureOptions): Promise<string[]> {
    const warnings: string[] = []
    const mic = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: o.micDeviceId && o.micDeviceId !== 'default' ? { exact: o.micDeviceId } : undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })
    this.micLabel = mic.getAudioTracks()[0]?.label ?? ''
    let prospect: MediaStream | undefined
    try {
      if (o.prospectSource === 'system') {
        const display = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })
        display.getVideoTracks().forEach((t) => t.stop())
        if (display.getAudioTracks().length === 0) throw new Error("aucune piste audio système (voir l'aide macOS dans les réglages)")
        prospect = new MediaStream(display.getAudioTracks())
      } else {
        prospect = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: o.prospectSource }, echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      }
    } catch (err) {
      warnings.push(`Audio du prospect indisponible : ${(err as Error).message}. Seul le micro est transcrit.`)
    }

    this.ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
    // Sans geste récent de l'utilisateur, le contexte démarre suspendu : on le relance explicitement.
    if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {})
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }))
    await this.ctx.audioWorklet.addModule(url)
    URL.revokeObjectURL(url)
    const sink = this.ctx.createGain()
    sink.gain.value = 0
    sink.connect(this.ctx.destination)

    const add = (speaker: Speaker, stream: MediaStream) => {
      const chunker = new VadChunker((c) => this.sending && window.autobuild.sendChunk(speaker, c.startMs, c.endMs, encodeWav(c.samples, SAMPLE_RATE)), { sampleRate: SAMPLE_RATE })
      const ch: Channel = { speaker, stream, chunker, samples: 0, level: 0 }
      const source = this.ctx!.createMediaStreamSource(stream)
      const node = new AudioWorkletNode(this.ctx!, 'pcm-capture')
      node.port.onmessage = (e: MessageEvent<Float32Array>) => {
        const frame = e.data
        let peak = 0
        for (let i = 0; i < frame.length; i += 8) peak = Math.max(peak, Math.abs(frame[i]))
        ch.level = Math.max(peak, ch.level * 0.85)
        // Le temps de la transcription démarre au lancement de l'enregistrement, pas au test du son.
        if (!this.sending) return
        const atMs = (ch.samples / SAMPLE_RATE) * 1000
        ch.samples += frame.length
        if (o.mode === 'live') window.autobuild.sendPcm(speaker, floatToPcm16(frame), atMs)
        else ch.chunker.push(frame)
      }
      source.connect(node)
      node.connect(sink)
      ch.node = node
      this.channels.push(ch)
    }
    add('commercial', mic)
    if (prospect) add('prospect', prospect)
    this.hasProspect = !!prospect

    this.levelTimer = setInterval(() => {
      const levels = { commercial: 0, prospect: 0 } as Record<Speaker, number>
      for (const c of this.channels) levels[c.speaker] = Math.min(1, c.level * 2.5)
      o.onLevels?.(levels)
      if (this.sending) window.autobuild.sendLevels(levels)
    }, 200)
    return warnings
  }

  async stop(): Promise<void> {
    if (this.levelTimer) clearInterval(this.levelTimer)
    for (const c of this.channels) {
      c.chunker.flush()
      c.node?.disconnect()
      c.stream.getTracks().forEach((t) => t.stop())
    }
    this.channels = []
    await this.ctx?.close().catch(() => {})
    this.ctx = undefined
  }
}

export async function listInputDevices(): Promise<MediaDeviceInfo[]> {
  // Les libellés ne sont visibles qu'après une première autorisation du micro.
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true })
    s.getTracks().forEach((t) => t.stop())
  } catch {
    /* refus : libellés vides */
  }
  return (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput')
}
