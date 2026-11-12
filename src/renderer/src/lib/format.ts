// Mise en forme (dates en français, statuts, initiales).
import { getProjectType } from '@shared/catalog'
import type { Rdv, RdvContexte, RdvStatut } from '@shared/types'

const DAY = 86_400_000

export function startOfDay(d: Date | number): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

export function heure(iso: string | number): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function dateCourte(iso: string | number): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export function dateLongue(iso: string | number): string {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** « Aujourd'hui », « Demain », « Vendredi », « 18 nov. ». */
export function jour(iso: string | number): string {
  const diff = Math.round((startOfDay(new Date(iso)) - startOfDay(Date.now())) / DAY)
  if (diff === 0) return 'Aujourd’hui'
  if (diff === 1) return 'Demain'
  if (diff === -1) return 'Hier'
  if (diff > 1 && diff < 7) return cap(new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long' }))
  return dateCourte(iso)
}

/** « dans 45 min », « dans 2 h », « il y a 3 jours »… */
export function relatif(iso: string | number): string {
  const ms = new Date(iso).getTime() - Date.now()
  const abs = Math.abs(ms)
  const min = Math.round(abs / 60_000)
  const fmt = (v: string) => (ms >= 0 ? `dans ${v}` : `il y a ${v}`)
  if (min < 1) return 'maintenant'
  if (min < 60) return fmt(`${min} min`)
  const h = Math.round(min / 60)
  if (h < 24) return fmt(`${h} h`)
  const d = Math.round(h / 24)
  return fmt(`${d} jour${d > 1 ? 's' : ''}`)
}

export function duree(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function dureeMin(r: Rdv): number | undefined {
  return r.startedAt && r.endedAt ? Math.max(1, Math.round((r.endedAt - r.startedAt) / 60_000)) : undefined
}

export function initiales(nom: string): string {
  return (
    nom
      .split(/[\s-]+/)
      .filter((p) => p && /[A-Za-zÀ-ÿ0-9]/.test(p[0]))
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || '?'
  )
}

export const STATUTS: Record<RdvStatut, { label: string; tone: 'ok' | 'wip' | 'todo' | 'err' | 'rec' | 'past' }> = {
  a_preparer: { label: 'À préparer', tone: 'todo' },
  preparation: { label: 'Préparation…', tone: 'wip' },
  pret: { label: 'Prêt', tone: 'ok' },
  erreur: { label: 'Préparation à reprendre', tone: 'err' },
  en_cours: { label: 'En cours', tone: 'rec' },
  termine: { label: 'Terminé', tone: 'past' }
}

export const CONTEXTES: Record<RdvContexte, string> = {
  lead: 'Lead entrant',
  appel_offres: 'Appel d’offres',
  recommandation: 'Recommandation',
  client: 'Client existant'
}

export function typeLabel(r: Rdv): string {
  const t = getProjectType(r.brief.typeProjet)
  if (t) return t.label
  const p = getProjectType(r.typePressenti)
  return p ? `${p.label} (pressenti)` : 'À déterminer'
}

export function pluriel(n: number, s: string, p = `${s}s`): string {
  return `${n} ${n > 1 ? p : s}`
}
