// Outils partagés par les pages de la bibliothèque : choix de l'entité source, données fictives stables.
// Les pages de la bibliothèque s'appuient sur les entités de app.json ; si aucune ne convient,
// elles génèrent des contenus génériques plausibles (toujours les mêmes d'un rechargement à l'autre).
import { app, brand } from '../../mockup'
import type { Entity, Field } from '../../mockup/types'

export type Row = Record<string, string | number | boolean | null>

export interface LibraryPageProps {
  itemId?: string
  /** Entité indiquée dans la navigation (`source`), sinon la page choisit la plus adaptée. */
  source?: string
}

export function fieldOf(e: Entity | undefined, pred: (f: Field) => boolean): Field | undefined {
  return e?.champs.find(pred)
}

/** Entité source : celle demandée, sinon la première qui satisfait le critère, sinon la première entité. */
export function pickEntity(source: string | undefined, pred: (e: Entity) => boolean = () => true): Entity | undefined {
  return app.entites.find((e) => e.id === source) ?? app.entites.find(pred) ?? app.entites[0]
}

export function hasType(e: Entity, ...types: Field['type'][]): boolean {
  return e.champs.some((f) => types.includes(f.type))
}

export function byName(e: Entity, re: RegExp): boolean {
  return re.test(`${e.id} ${e.label} ${e.labelPluriel}`.toLowerCase())
}

/** Générateur pseudo-aléatoire déterministe (mêmes valeurs à chaque affichage). */
export function rng(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return (h >>> 0) / 4294967296
  }
}

export function pick<T>(r: () => number, list: T[]): T {
  return list[Math.floor(r() * list.length)]
}

export const PRENOMS = ['Claire', 'Julien', 'Sophie', 'Thomas', 'Camille', 'Nicolas', 'Laura', 'Antoine', 'Émilie', 'Mathieu', 'Sarah', 'Pierre', 'Manon', 'Hugo', 'Céline', 'Romain', 'Julie', 'Maxime', 'Aurélie', 'Vincent']
export const NOMS = ['Martin', 'Bernard', 'Dubois', 'Moreau', 'Laurent', 'Girard', 'Roux', 'Fontaine', 'Mercier', 'Lefèvre', 'Garnier', 'Chevalier', 'Perrin', 'Morel', 'Faure', 'Lambert', 'Rousseau', 'Blanc', 'Guérin', 'Henry']
export const SERVICES = ['Direction', 'Commercial', 'Exploitation', 'Administration et finances', 'Ressources humaines', 'Qualité', 'Informatique', 'Logistique']
export const VILLES = ['Lyon', 'Nantes', 'Bordeaux', 'Lille', 'Toulouse', 'Rennes', 'Grenoble', 'Strasbourg', 'Marseille', 'Dijon']

/** Domaine e-mail du prospect (à partir de son site). */
export function domaine(): string {
  try {
    if (brand.url) return new URL(brand.url).hostname.replace(/^www\./, '')
  } catch {
    /* url invalide */
  }
  return brand.nomEntreprise.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '') + '.fr'
}

export function email(nom: string): string {
  const [p, ...n] = nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/)
  return `${(p ?? '').replace(/[^a-z]/g, '')}.${n.join('').replace(/[^a-z]/g, '')}@${domaine()}`
}

export function telephone(r: () => number): string {
  const n = () => String(Math.floor(r() * 90) + 10)
  return `0${pick(r, ['1', '4', '6', '7'])} ${n()} ${n()} ${n()} ${n()}`
}

/** Personnes citées dans les données (champs « personne ») + utilisateur, complétées par des noms fictifs. */
export function people(min = 8): string[] {
  const set = new Set<string>([app.utilisateur.nom])
  for (const e of app.entites) for (const f of e.champs) if (f.type === 'personne') for (const d of e.donnees) if (typeof d[f.id] === 'string' && d[f.id]) set.add(String(d[f.id]))
  const r = rng(brand.nomEntreprise + 'personnes')
  while (set.size < min) set.add(`${pick(r, PRENOMS)} ${pick(r, NOMS)}`)
  return [...set]
}

export function titleOf(e: Entity, row: Row): string {
  return String(row[e.champTitre] ?? row.id ?? '')
}

export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

/** Date relative au jour de la démo (les contenus générés restent « récents »). */
export function daysAgo(n: number): string {
  return isoDay(addDays(new Date(), -n))
}
