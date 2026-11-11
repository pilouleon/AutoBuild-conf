import { describe, expect, it } from 'vitest'
import { type AudioChunk, VadChunker, encodeWav } from './chunker'

const SR = 16000
function tone(ms: number, amp = 0.2): Float32Array {
  const n = (SR * ms) / 1000
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * 220 * i) / SR)
  return out
}
const silence = (ms: number) => new Float32Array((SR * ms) / 1000)

describe('VadChunker', () => {
  it('coupe sur un silence après la durée minimale', () => {
    const chunks: AudioChunk[] = []
    const c = new VadChunker((x) => chunks.push(x))
    c.push(tone(4000)); c.push(silence(800)); c.push(tone(2000)); c.flush()
    expect(chunks.length).toBe(2)
    expect(chunks[0].endMs - chunks[0].startMs).toBeGreaterThanOrEqual(4000)
    expect(chunks[1].startMs).toBeGreaterThanOrEqual(4000)
  })
  it('coupe de force au-delà de la durée max', () => {
    const chunks: AudioChunk[] = []
    const c = new VadChunker((x) => chunks.push(x))
    c.push(tone(30000)); c.flush()
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    expect(Math.max(...chunks.map((k) => k.endMs - k.startMs))).toBeLessThanOrEqual(14000)
  })
  it("n'envoie pas le silence ni le bruit faible", () => {
    const chunks: AudioChunk[] = []
    const c = new VadChunker((x) => chunks.push(x))
    c.push(silence(20000)); c.push(tone(10000, 0.002)); c.flush()
    expect(chunks.length).toBe(0)
  })
  it('encode un WAV valide', () => {
    const wav = encodeWav(tone(100), SR)
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF')
    expect(wav.length).toBe(44 + 1600 * 2)
  })
})
