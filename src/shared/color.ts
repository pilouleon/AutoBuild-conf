// Outils couleur (purs) : analyse des couleurs d'un site / d'un logo.

export interface Rgb {
  r: number
  g: number
  b: number
}

export function parseColor(input: string): Rgb | undefined {
  const s = input.trim().toLowerCase()
  let m = s.match(/^#([0-9a-f]{3,8})$/)
  if (m) {
    let hex = m[1]
    if (hex.length === 3 || hex.length === 4) hex = hex.slice(0, 3).split('').map((c) => c + c).join('')
    if (hex.length < 6) return undefined
    return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) }
  }
  m = s.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/)
  if (m) return { r: +m[1], g: +m[2], b: +m[3] }
  return undefined
}

export function toHex({ r, g, b }: Rgb): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
}

export function toHsl({ r, g, b }: Rgb): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return { h: h * 60, s, l }
}

/** Couleur « de marque » plausible : ni gris, ni quasi blanc, ni quasi noir. */
export function isBrandish(c: Rgb): boolean {
  const { s, l } = toHsl(c)
  return s >= 0.22 && l >= 0.12 && l <= 0.88
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

/**
 * Choisit une palette (primaire, secondaire, accent) à partir de couleurs pondérées.
 * Les couleurs proches sont regroupées.
 */
export function pickPalette(weighted: { color: Rgb; weight: number }[]): { primaire?: string; secondaire?: string; accent?: string } {
  const buckets: { color: Rgb; weight: number }[] = []
  for (const w of weighted) {
    if (!isBrandish(w.color)) continue
    const hit = buckets.find((b) => colorDistance(b.color, w.color) < 40)
    if (hit) hit.weight += w.weight
    else buckets.push({ color: w.color, weight: w.weight })
  }
  buckets.sort((a, b) => b.weight - a.weight)
  const chosen: Rgb[] = []
  for (const b of buckets) {
    if (chosen.every((c) => hueDistance(toHsl(c).h, toHsl(b.color).h) > 25 || Math.abs(toHsl(c).l - toHsl(b.color).l) > 0.25)) chosen.push(b.color)
    if (chosen.length === 3) break
  }
  return { primaire: chosen[0] && toHex(chosen[0]), secondaire: chosen[1] && toHex(chosen[1]), accent: chosen[2] && toHex(chosen[2]) }
}

export function colorDistance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)
}

/** Couleurs dominantes d'une image (bitmap RGBA ou BGRA). */
export function dominantColorsFromBitmap(data: Uint8Array, width: number, height: number, bgra = false): { color: Rgb; weight: number }[] {
  const step = Math.max(1, Math.floor((width * height) / 20000))
  const counts = new Map<string, { color: Rgb; weight: number }>()
  for (let i = 0; i < width * height; i += step) {
    const o = i * 4
    const a = data[o + 3]
    if (a < 200) continue
    const r = bgra ? data[o + 2] : data[o]
    const b = bgra ? data[o] : data[o + 2]
    const c = { r: r & 0xf0, g: data[o + 1] & 0xf0, b: b & 0xf0 }
    const key = `${c.r},${c.g},${c.b}`
    const cur = counts.get(key)
    if (cur) cur.weight++
    else counts.set(key, { color: { r, g: data[o + 1], b }, weight: 1 })
  }
  return [...counts.values()].sort((x, y) => y.weight - x.weight).slice(0, 30)
}
