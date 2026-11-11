const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const nombre = new Intl.NumberFormat('fr-FR')

export function formatValue(value: unknown, format?: string): string {
  if (value === null || value === undefined || value === '') return '—'
  if (format === 'euro' && typeof value === 'number') return euro.format(value)
  if (format === 'pourcent' && typeof value === 'number') return `${nombre.format(value)} %`
  if (format === 'date' && typeof value === 'string') return formatDate(value)
  if (format === 'booleen') return value ? 'Oui' : 'Non'
  if (typeof value === 'number') return nombre.format(value)
  return String(value)
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}
