// Extraction de l'identité du prospect depuis son site web :
// nom, logo, couleurs, police, description et textes clés (réutilisés dans la maquette).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, type HTMLElement } from 'node-html-parser'
import { type Rgb, dominantColorsFromBitmap, parseColor, pickPalette } from '@shared/color'
import type { Brand } from '@shared/types'

export interface SiteAnalysis {
  ton?: string
  secteur?: string
  description?: string
  slogan?: string
  /** Noms propres, produits, services cités sur le site (aide la transcription et la maquette). */
  vocabulaire?: string[]
}

export interface ExtractOptions {
  /** Dossier où enregistrer le logo et le texte du site. */
  destDir: string
  /** Décodage d'images raster (fourni par Electron via nativeImage) pour lire les couleurs du logo. */
  decodeImage?: (bytes: Uint8Array) => { data: Uint8Array; width: number; height: number; bgra: boolean } | undefined
  /** Analyse du texte par un LLM (ton, secteur...). Optionnel. */
  analyze?: (siteText: string, nom: string) => Promise<SiteAnalysis>
  log?: (msg: string) => void
}

export interface ExtractResult {
  brand: Brand
  siteText: string
  secteur?: string
  vocabulaire: string[]
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'

async function fetchBytes(url: string, timeoutMs = 10_000): Promise<{ bytes: Uint8Array; type: string; finalUrl: string }> {
  if (url.startsWith('file:')) {
    const path = fileURLToPath(url)
    const ext = extname(path).toLowerCase()
    const type =
      { '.html': 'text/html', '.htm': 'text/html', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' }[ext] ?? 'application/octet-stream'
    return { bytes: new Uint8Array(readFileSync(path)), type, finalUrl: url }
  }
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*' }, redirect: 'follow', signal: ctrl.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return { bytes: new Uint8Array(await res.arrayBuffer()), type: res.headers.get('content-type') ?? '', finalUrl: res.url || url }
  } finally {
    clearTimeout(t)
  }
}

const text = (b: Uint8Array) => new TextDecoder('utf-8').decode(b)

export function normalizeUrl(input: string): string {
  const s = input.trim()
  if (!s) return s
  if (/^[a-z]+:\/\//i.test(s)) return s
  return `https://${s}`
}

function abs(href: string | undefined, base: string): string | undefined {
  if (!href) return undefined
  try {
    return new URL(href.trim(), base).href
  } catch {
    return undefined
  }
}

function cleanTitle(title: string): string {
  const parts = title.split(/\s+[|\-–—:·]\s+/).map((p) => p.trim()).filter(Boolean)
  if (parts.length <= 1) return title.trim()
  // Le nom de marque est en général la partie la plus courte.
  return parts.sort((a, b) => a.length - b.length)[0]
}

export async function extractBrand(inputUrl: string, opts: ExtractOptions): Promise<ExtractResult> {
  const log = opts.log ?? (() => {})
  const url = normalizeUrl(inputUrl)
  mkdirSync(opts.destDir, { recursive: true })
  const sources: string[] = []

  const page = await fetchBytes(url)
  const base = page.finalUrl
  const root = parse(text(page.bytes))
  const meta = (sel: string) => root.querySelector(sel)?.getAttribute('content')?.trim() || undefined

  // ── Nom ───────────────────────────────────────────────────────
  const host = (() => {
    try {
      return new URL(base).hostname.replace(/^www\./, '')
    } catch {
      return ''
    }
  })()
  const nom =
    meta('meta[property="og:site_name"]') ||
    meta('meta[name="application-name"]') ||
    cleanTitle(root.querySelector('title')?.text ?? '') ||
    host.split('.')[0]
  sources.push('nom : balises du site')

  // ── Textes ────────────────────────────────────────────────────
  const description = meta('meta[name="description"]') || meta('meta[property="og:description"]')
  const h1 = root.querySelector('h1')?.text.replace(/\s+/g, ' ').trim()
  const siteText = collectText(root)
  writeFileSync(join(opts.destDir, 'site.txt'), `Source : ${base}\n\n${siteText}`, 'utf8')

  // ── Couleurs ──────────────────────────────────────────────────
  const weighted: { color: Rgb; weight: number }[] = []
  const add = (raw: string | undefined, weight: number) => {
    const c = raw ? parseColor(raw) : undefined
    if (c) weighted.push({ color: c, weight })
  }
  add(meta('meta[name="theme-color"]'), 40)
  add(meta('meta[name="msapplication-TileColor"]'), 20)
  const cssTexts: string[] = root.querySelectorAll('style').map((s) => s.text)
  for (const el of root.querySelectorAll('[style]')) cssTexts.push(el.getAttribute('style') ?? '')
  const cssLinks = root
    .querySelectorAll('link[rel="stylesheet"]')
    .map((l) => abs(l.getAttribute('href'), base))
    .filter((h): h is string => !!h)
    .slice(0, 4)
  for (const href of cssLinks) {
    try {
      const css = await fetchBytes(href, 6000)
      if (css.bytes.length < 800_000) cssTexts.push(text(css.bytes))
    } catch {
      /* feuille inaccessible : on continue */
    }
  }
  for (const css of cssTexts) scoreCss(css, add)

  // ── Police ────────────────────────────────────────────────────
  let police: string | undefined
  const gf = root.querySelectorAll('link[href*="fonts.googleapis.com"]').map((l) => l.getAttribute('href') ?? '')[0]
  if (gf) police = decodeURIComponent(gf.match(/family=([^:&]+)/)?.[1] ?? '').replace(/\+/g, ' ') || undefined
  if (!police) {
    const ff = cssTexts.join('\n').match(/font-family\s*:\s*["']?([^;"',}]+)/i)?.[1]?.trim()
    if (ff && !/^(inherit|initial|sans-serif|serif|system-ui|-apple-system|arial|helvetica)$/i.test(ff)) police = ff
  }

  // ── Logo ──────────────────────────────────────────────────────
  const logo = await downloadLogo(root, base, opts, log)
  if (logo) {
    sources.push(`logo : ${logo.from}`)
    for (const c of logo.colors) weighted.push({ color: c.color, weight: c.weight })
  }

  const palette = pickPalette(weighted)
  if (palette.primaire) sources.push('couleurs : feuilles de style, theme-color et logo')

  // ── Analyse par LLM (ton, secteur) ────────────────────────────
  let analysis: SiteAnalysis = {}
  if (opts.analyze) {
    try {
      analysis = await opts.analyze(siteText.slice(0, 6000), nom)
      sources.push('ton et secteur : analyse IA du texte du site')
    } catch (err) {
      log(`Analyse du site par l'IA impossible : ${(err as Error).message}`)
    }
  }

  const brand: Brand = {
    nomEntreprise: nom,
    url: base,
    logoPath: logo?.path,
    logoUrl: logo?.url,
    couleurs: { primaire: palette.primaire ?? '#2563eb', secondaire: palette.secondaire, accent: palette.accent },
    description: analysis.description || description,
    ton: analysis.ton,
    slogan: analysis.slogan || h1,
    police,
    sources
  }
  if (!palette.primaire) sources.push('couleurs : non trouvées, palette neutre par défaut')
  return { brand, siteText, secteur: analysis.secteur, vocabulaire: analysis.vocabulaire ?? [] }
}

function scoreCss(css: string, add: (raw: string, w: number) => void): void {
  // Variables CSS nommées "primary", "brand", "main"… : signal fort.
  for (const m of css.matchAll(/--[\w-]*(primary|brand|main|accent|secondary|theme)[\w-]*\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]+\))/gi)) add(m[2], 12)
  // Règles sur boutons, liens, en-têtes : signal moyen.
  for (const m of css.matchAll(/([^{}]{1,200})\{([^{}]{0,2000})\}/g)) {
    const sel = m[1].toLowerCase()
    const important = /(btn|button|header|nav|\ba\b|a:hover|primary|brand|cta|menu|footer)/.test(sel)
    for (const c of m[2].matchAll(/(?:color|background(?:-color)?|border(?:-color)?|fill)\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]+\))/gi)) add(c[1], important ? 4 : 1)
  }
}

function collectText(root: HTMLElement): string {
  const parts: string[] = []
  const seen = new Set<string>()
  for (const el of root.querySelectorAll('h1, h2, h3, p, li, nav a')) {
    const t = el.text.replace(/\s+/g, ' ').trim()
    if (t.length < 3 || t.length > 400 || seen.has(t)) continue
    seen.add(t)
    const tag = el.tagName.toLowerCase()
    parts.push(tag.startsWith('h') ? `\n## ${t}` : tag === 'a' ? `- (menu) ${t}` : t)
    if (parts.join('\n').length > 12_000) break
  }
  return parts.join('\n').trim()
}

async function downloadLogo(
  root: HTMLElement,
  base: string,
  opts: ExtractOptions,
  log: (m: string) => void
): Promise<{ path: string; url: string; from: string; colors: { color: Rgb; weight: number }[] } | undefined> {
  const candidates: { url: string; from: string }[] = []
  const push = (u: string | undefined, from: string) => {
    const a = abs(u, base)
    if (a && !candidates.some((c) => c.url === a)) candidates.push({ url: a, from })
  }
  // 1. <img> qui ressemble à un logo, en priorité dans l'en-tête.
  const imgs = [...root.querySelectorAll('header img, nav img'), ...root.querySelectorAll('img')]
  for (const img of imgs) {
    const hay = `${img.getAttribute('src') ?? ''} ${img.getAttribute('alt') ?? ''} ${img.getAttribute('class') ?? ''} ${img.getAttribute('id') ?? ''} ${img.parentNode?.getAttribute?.('class') ?? ''}`.toLowerCase()
    if (hay.includes('logo')) push(img.getAttribute('src') ?? img.getAttribute('data-src'), 'image « logo » du site')
  }
  // 2. Icônes déclarées (les plus grandes d'abord).
  const icons = root
    .querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]')
    .map((l) => ({ href: l.getAttribute('href'), size: parseInt((l.getAttribute('sizes') ?? '0').split('x')[0]) || (l.getAttribute('href')?.endsWith('.svg') ? 512 : 16) }))
    .sort((a, b) => b.size - a.size)
  for (const i of icons) push(i.href, 'icône du site')
  push(root.querySelector('meta[property="og:image"]')?.getAttribute('content'), 'image de partage (og:image)')
  push('/favicon.ico', 'favicon')

  for (const c of candidates.slice(0, 6)) {
    try {
      const img = await fetchBytes(c.url, 8000)
      const isSvg = img.type.includes('svg') || c.url.toLowerCase().split('?')[0].endsWith('.svg')
      if (!img.type.startsWith('image/') && !isSvg) continue
      if (img.bytes.length < 120) continue
      const ext = isSvg ? '.svg' : img.type.includes('png') ? '.png' : img.type.includes('jpeg') ? '.jpg' : img.type.includes('webp') ? '.webp' : img.type.includes('icon') ? '.ico' : '.png'
      const path = join(opts.destDir, `logo${ext}`)
      writeFileSync(path, img.bytes)
      let colors: { color: Rgb; weight: number }[] = []
      if (isSvg) {
        for (const m of text(img.bytes).matchAll(/(?:fill|stroke|stop-color)\s*[:=]\s*["']?(#[0-9a-f]{3,8}|rgba?\([^)]+\))/gi)) {
          const col = parseColor(m[1])
          if (col) colors.push({ color: col, weight: 15 })
        }
      } else if (opts.decodeImage) {
        const bmp = opts.decodeImage(img.bytes)
        if (bmp) colors = dominantColorsFromBitmap(bmp.data, bmp.width, bmp.height, bmp.bgra).map((x) => ({ color: x.color, weight: Math.min(30, x.weight / 50) }))
      }
      return { path, url: c.url, from: c.from, colors }
    } catch (err) {
      log(`Logo ${c.url} : ${(err as Error).message}`)
    }
  }
  return undefined
}
