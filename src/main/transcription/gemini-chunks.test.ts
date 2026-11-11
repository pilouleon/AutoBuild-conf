import { describe, expect, it, vi } from 'vitest'
import type { RawSegment } from './types'

const calls: { prompt: string; mime: string }[] = []
let failNext = 0
const answers: string[] = []

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = {
      generateContent: async (req: { contents: { parts: ({ text?: string; inlineData?: { mimeType: string } })[] }[] }) => {
        const parts = req.contents[0].parts
        calls.push({ prompt: parts.find((p) => p.text)?.text ?? '', mime: parts.find((p) => p.inlineData)?.inlineData?.mimeType ?? '' })
        if (failNext > 0) {
          failNext--
          throw new Error('503 indisponible')
        }
        await new Promise((r) => setTimeout(r, 5))
        return { text: answers.shift() ?? 'texte' }
      }
    }
  }
}))

const { GeminiChunkTranscriber } = await import('./gemini-chunks')

describe('GeminiChunkTranscriber', () => {
  it('transcrit dans l’ordre, ignore les silences, garde le contexte et le vocabulaire', async () => {
    answers.push('Bonjour, on gère des chantiers.', '[silence]', 'Et on veut un planning.')
    const segs: RawSegment[] = []
    const errors: string[] = []
    const t = new GeminiChunkTranscriber('k', 'gemini-3.8-flash', { onSegment: (s) => segs.push(s), onError: (e) => errors.push(e) }, ['Ternovia'])
    await t.start()
    const wav = new Uint8Array(100)
    t.pushChunk('prospect', 0, 5000, wav)
    t.pushChunk('prospect', 5000, 9000, wav)
    t.pushChunk('prospect', 9000, 14000, wav)
    await t.stop()
    expect(segs.map((s) => s.text)).toEqual(['Bonjour, on gère des chantiers.', 'Et on veut un planning.'])
    expect(segs[1].startMs).toBe(9000)
    expect(calls[0].mime).toBe('audio/wav')
    expect(calls[0].prompt).toContain('Ternovia')
    expect(calls[1].prompt).toContain('Bonjour, on gère des chantiers.')
    expect(errors).toEqual([])
  })

  it('réessaie une fois en cas d’erreur', async () => {
    calls.length = 0
    failNext = 1
    answers.push('Bonjour.')
    const segs: RawSegment[] = []
    const t = new GeminiChunkTranscriber('k', 'm', { onSegment: (s) => segs.push(s), onError: () => {} })
    await t.start()
    t.pushChunk('commercial', 0, 3000, new Uint8Array(10))
    await t.stop()
    expect(calls.length).toBe(2)
    expect(segs.length).toBe(1)
  })
})
