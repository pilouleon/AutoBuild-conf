import type { Speaker } from '@shared/types'

export interface RawSegment {
  speaker: Speaker
  startMs: number
  endMs: number
  text: string
}

export interface TranscriberEvents {
  onSegment: (seg: RawSegment) => void
  /** Texte provisoire (mode Live) ; chaîne vide pour effacer. */
  onInterim?: (speaker: Speaker, text: string) => void
  onError: (message: string) => void
  onInfo?: (message: string) => void
}

/**
 * Un transcripteur reçoit l'audio des deux canaux et émet des segments de texte.
 * - mode « tronçons » : pushChunk() avec un WAV par tronçon (découpé sur les silences) ;
 * - mode « live » : pushPcm() avec un flux PCM 16 bits 16 kHz continu.
 */
export interface Transcriber {
  readonly mode: 'tronçons' | 'live'
  start(): Promise<void>
  pushChunk(speaker: Speaker, startMs: number, endMs: number, wav: Uint8Array): void
  pushPcm(speaker: Speaker, pcm: Uint8Array, atMs: number): void
  stop(): Promise<void>
}
