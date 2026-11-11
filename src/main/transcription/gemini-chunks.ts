// Mode A : transcription par tronçons avec Gemini (generateContent + audio WAV en ligne).
// Chaque canal est traité dans l'ordre (file par locuteur) pour garder le contexte ;
// les deux canaux tournent en parallèle.

import { GoogleGenAI } from '@google/genai'
import type { Speaker } from '@shared/types'
import type { Transcriber, TranscriberEvents } from './types'

interface Job {
  speaker: Speaker
  startMs: number
  endMs: number
  wav: Uint8Array
}

const SILENCE = '[silence]'

export class GeminiChunkTranscriber implements Transcriber {
  readonly mode = 'tronçons' as const
  private ai: GoogleGenAI
  private queues: Record<Speaker, Job[]> = { commercial: [], prospect: [] }
  private busy: Record<Speaker, boolean> = { commercial: false, prospect: false }
  private context: Record<Speaker, string[]> = { commercial: [], prospect: [] }
  private stopped = false

  constructor(
    apiKey: string,
    private model: string,
    private events: TranscriberEvents,
    /** Vocabulaire utile (nom de l'entreprise, produits) pour aider la reconnaissance. */
    private vocabulaire: string[] = []
  ) {
    this.ai = new GoogleGenAI({ apiKey })
  }

  async start(): Promise<void> {
    this.stopped = false
  }

  pushChunk(speaker: Speaker, startMs: number, endMs: number, wav: Uint8Array): void {
    if (this.stopped) return
    this.queues[speaker].push({ speaker, startMs, endMs, wav })
    void this.drain(speaker)
  }

  pushPcm(): void {
    // Non utilisé en mode tronçons.
  }

  async stop(): Promise<void> {
    // On laisse finir les tronçons déjà en file (fin d'appel).
    const deadline = Date.now() + 30_000
    while ((this.busy.commercial || this.busy.prospect || this.queues.commercial.length || this.queues.prospect.length) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200))
    }
    this.stopped = true
  }

  private async drain(speaker: Speaker): Promise<void> {
    if (this.busy[speaker]) return
    this.busy[speaker] = true
    try {
      while (this.queues[speaker].length) {
        const job = this.queues[speaker].shift()!
        const text = await this.transcribeWithRetry(job)
        if (text) {
          this.context[speaker] = [...this.context[speaker], text].slice(-3)
          this.events.onSegment({ speaker, startMs: job.startMs, endMs: job.endMs, text })
        }
      }
    } finally {
      this.busy[speaker] = false
    }
  }

  private async transcribeWithRetry(job: Job): Promise<string> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.transcribe(job)
      } catch (err) {
        if (attempt === 1) this.events.onError(`Transcription Gemini (${job.speaker}) : ${(err as Error).message}`)
        else await new Promise((r) => setTimeout(r, 800))
      }
    }
    return ''
  }

  private async transcribe(job: Job): Promise<string> {
    const qui = job.speaker === 'commercial' ? 'le commercial (micro)' : 'le prospect (audio de la visio, une ou plusieurs personnes)'
    const contexte = this.context[job.speaker].join(' ')
    const prompt = [
      `Transcris mot pour mot cet extrait audio en français. Il s'agit de ${qui} pendant un rendez-vous commercial en visio.`,
      'Ne résume pas, ne traduis pas, ne commente pas. Écris uniquement ce qui est dit, avec la ponctuation.',
      `Si l'extrait ne contient aucune parole intelligible, réponds exactement ${SILENCE}.`,
      this.vocabulaire.length ? `Vocabulaire possible (noms propres) : ${this.vocabulaire.join(', ')}.` : '',
      contexte ? `Pour le contexte uniquement (ne pas le recopier), la phrase précédente était : « ${contexte.slice(-400)} »` : ''
    ]
      .filter(Boolean)
      .join('\n')

    const res = await this.ai.models.generateContent({
      model: this.model,
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType: 'audio/wav', data: Buffer.from(job.wav).toString('base64') } }, { text: prompt }]
        }
      ],
      config: { temperature: 0 }
    })
    const text = (res.text ?? '').trim()
    if (!text || text.toLowerCase().includes(SILENCE)) return ''
    return text.replace(/^["«\s]+|["»\s]+$/g, '')
  }
}
