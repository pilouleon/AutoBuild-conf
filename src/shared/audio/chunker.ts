// Découpe un flux audio PCM (Float32, mono) en tronçons pour la transcription,
// en coupant de préférence sur les silences (détection d'activité vocale par énergie).
// Pur TypeScript : utilisé dans le renderer, testable sous Node.

export interface ChunkerOptions {
  sampleRate: number
  /** Durée d'une trame d'analyse. */
  frameMs: number
  /** On ne coupe pas un tronçon plus court que ça (sauf flush). */
  minChunkMs: number
  /** On coupe de force au-delà. */
  maxChunkMs: number
  /** Silence continu nécessaire pour couper. */
  silenceMs: number
  /** Seuil d'énergie absolu minimal (RMS) pour considérer une trame comme de la voix. */
  minSpeechRms: number
  /** Part minimale de trames voisées pour envoyer un tronçon (sinon : bruit, on jette). */
  minVoicedRatio: number
}

export const DEFAULT_CHUNKER: ChunkerOptions = {
  sampleRate: 16000,
  frameMs: 20,
  minChunkMs: 3000,
  maxChunkMs: 14000,
  silenceMs: 650,
  minSpeechRms: 0.008,
  minVoicedRatio: 0.12
}

export interface AudioChunk {
  startMs: number
  endMs: number
  samples: Float32Array
  voicedRatio: number
}

export class VadChunker {
  private opts: ChunkerOptions
  private frameSize: number
  private pending: Float32Array = new Float32Array(0)
  private chunkFrames: Float32Array[] = []
  private chunkStartMs = 0
  private totalMs = 0
  private silenceRunMs = 0
  private voicedFrames = 0
  private noiseFloor = 0.003
  /** Niveau RMS de la dernière trame (pour le vumètre). */
  level = 0

  constructor(private onChunk: (c: AudioChunk) => void, opts: Partial<ChunkerOptions> = {}) {
    this.opts = { ...DEFAULT_CHUNKER, ...opts }
    this.frameSize = Math.round((this.opts.sampleRate * this.opts.frameMs) / 1000)
  }

  push(input: Float32Array): void {
    const buf = new Float32Array(this.pending.length + input.length)
    buf.set(this.pending)
    buf.set(input, this.pending.length)
    let offset = 0
    while (offset + this.frameSize <= buf.length) {
      this.processFrame(buf.subarray(offset, offset + this.frameSize))
      offset += this.frameSize
    }
    this.pending = buf.slice(offset)
  }

  private processFrame(frame: Float32Array): void {
    let sum = 0
    for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i]
    const rms = Math.sqrt(sum / frame.length)
    this.level = rms
    const threshold = Math.max(this.opts.minSpeechRms, this.noiseFloor * 3)
    const voiced = rms > threshold
    // Plancher de bruit : descend vite, remonte lentement (uniquement sur les trames non voisées).
    if (!voiced) this.noiseFloor = rms < this.noiseFloor ? rms * 0.5 + this.noiseFloor * 0.5 : this.noiseFloor * 0.995 + rms * 0.005

    if (this.chunkFrames.length === 0) this.chunkStartMs = this.totalMs
    this.chunkFrames.push(frame.slice())
    this.totalMs += this.opts.frameMs
    if (voiced) {
      this.voicedFrames++
      this.silenceRunMs = 0
    } else {
      this.silenceRunMs += this.opts.frameMs
    }

    const durMs = this.chunkFrames.length * this.opts.frameMs
    // Longue période sans voix au début d'un tronçon : on ne garde que la fin (évite d'envoyer du silence).
    if (this.voicedFrames === 0 && durMs >= 1000) {
      this.chunkFrames = this.chunkFrames.slice(-10)
      this.chunkStartMs = this.totalMs - this.chunkFrames.length * this.opts.frameMs
      return
    }
    if ((durMs >= this.opts.minChunkMs && this.silenceRunMs >= this.opts.silenceMs) || durMs >= this.opts.maxChunkMs) {
      this.emit()
    }
  }

  /** Force l'envoi du tronçon en cours (fin d'écoute). */
  flush(): void {
    if (this.pending.length) {
      const pad = new Float32Array(this.frameSize)
      pad.set(this.pending)
      this.pending = new Float32Array(0)
      this.processFrame(pad)
    }
    this.emit()
  }

  private emit(): void {
    const frames = this.chunkFrames
    if (frames.length === 0) return
    const voicedRatio = this.voicedFrames / frames.length
    this.chunkFrames = []
    this.voicedFrames = 0
    this.silenceRunMs = 0
    if (voicedRatio < this.opts.minVoicedRatio) return
    const samples = new Float32Array(frames.length * this.frameSize)
    frames.forEach((f, i) => samples.set(f, i * this.frameSize))
    this.onChunk({ startMs: this.chunkStartMs, endMs: this.chunkStartMs + frames.length * this.opts.frameMs, samples, voicedRatio })
  }
}

/** Encode du PCM Float32 mono en WAV 16 bits. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataSize = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, dataSize, true)
  floatTo16(samples, view, 44)
  return new Uint8Array(buffer)
}

/** PCM Float32 → Int16 little-endian (format attendu par Gemini Live : audio/pcm;rate=16000). */
export function floatToPcm16(samples: Float32Array): Uint8Array {
  const buffer = new ArrayBuffer(samples.length * 2)
  floatTo16(samples, new DataView(buffer), 0)
  return new Uint8Array(buffer)
}

function floatTo16(samples: Float32Array, view: DataView, offset: number): void {
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
}
