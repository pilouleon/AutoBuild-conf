// Applique les couleurs de la marque du prospect aux variables CSS (voir index.css).
import type { Brand } from '../mockup/types'

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Texte lisible (blanc ou presque noir) sur une couleur de fond. */
export function contrastText(hex: string): string {
  return luminance(hex) > 0.45 ? '#111827' : '#ffffff'
}

export function applyBrand(brand: Brand): void {
  const root = document.documentElement
  const primaire = brand.couleurs.primaire || '#2563eb'
  const secondaire = brand.couleurs.secondaire || '#0f172a'
  const accent = brand.couleurs.accent || primaire
  root.style.setProperty('--brand-primary', primaire)
  root.style.setProperty('--brand-primary-fg', contrastText(primaire))
  root.style.setProperty('--brand-secondary', secondaire)
  root.style.setProperty('--brand-secondary-fg', contrastText(secondaire))
  root.style.setProperty('--brand-accent', accent)
  if (brand.police) {
    const family = brand.police.split(',')[0].trim()
    const id = 'brand-font'
    if (!document.getElementById(id)) {
      const link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@400;500;600;700&display=swap`
      document.head.appendChild(link)
    }
    root.style.setProperty('--brand-font', `'${family}', ui-sans-serif, system-ui, sans-serif`)
  }
  document.title = brand.nomEntreprise
}
