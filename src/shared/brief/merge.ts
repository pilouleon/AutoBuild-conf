// Application d'un patch du LLM au brief, avec vérification des preuves.
// Une mise à jour sans citation retrouvable dans le transcript est REJETÉE :
// c'est ce qui garantit la règle « une info manquante n'est jamais devinée ».

import type { TranscriptSegment } from '../types'
import { getProjectType } from '../catalog'
import { type Brief, type BriefPatch, type Evidence, type ExtraFieldDef, type FieldState, allFields, getField, normalizeBrief } from './schema'

export interface MergeReport {
  champsAjoutes: string[]
  accepted: string[]
  rejected: { fieldId: string; raison: string }[]
  typeProjetChange: boolean
}

/** Normalise pour comparer des citations : minuscules, sans accents ni ponctuation. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9€%]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Une citation est valide si elle figure dans le segment indiqué (ou, à défaut,
 * dans un segment voisin : les LLM se trompent parfois d'un cran), soit
 * mot pour mot après normalisation, soit avec au moins 85 % de ses mots
 * présents dans l'ordre.
 */
export function findEvidence(
  segments: TranscriptSegment[],
  segmentId: string,
  citation: string
): TranscriptSegment | undefined {
  const quote = normalize(citation)
  if (quote.length < 3) return undefined
  const idx = segments.findIndex((s) => s.id === segmentId)
  const candidates =
    idx >= 0 ? [segments[idx], segments[idx - 1], segments[idx + 1]].filter(Boolean) : segments
  for (const seg of candidates as TranscriptSegment[]) {
    if (quoteMatches(normalize(seg.text), quote)) return seg
  }
  return undefined
}

function quoteMatches(segment: string, quote: string): boolean {
  if (segment.includes(quote)) return true
  const words = quote.split(' ')
  if (words.length < 3) return false
  // Correspondance souple : les mots de la citation apparaissent dans l'ordre.
  let pos = 0
  let found = 0
  const segWords = segment.split(' ')
  for (const w of words) {
    const at = segWords.indexOf(w, pos)
    if (at >= 0) {
      found++
      pos = at + 1
    }
  }
  return found / words.length >= 0.85
}

const MAX_PREUVES = 6

export function applyPatch(
  brief: Brief,
  patch: BriefPatch,
  segments: TranscriptSegment[],
  now = Date.now()
): { brief: Brief; report: MergeReport } {
  const next: Brief = normalizeBrief(structuredClone(brief))
  const report: MergeReport = { accepted: [], rejected: [], typeProjetChange: false, champsAjoutes: [] }

  // 1. Infos proposées par l'IA pour CE projet (avant les mises à jour, qui peuvent déjà les remplir).
  for (const nf of patch.nouveauxChamps ?? []) {
    const added = addExtraField(next, { ...nf, origine: 'ia' }, now)
    if (added) report.champsAjoutes.push(added)
  }

  // 2. Type de projet : uniquement un id du catalogue, avec une preuve valide. Ajoute ses infos propres.
  const tp = patch.typeProjet?.trim()
  if (tp && tp !== next.typeProjet && getProjectType(tp)) {
    const p = patch.typeProjetPreuve
    const ok = p ? findEvidence(segments, p.segmentId, p.citation) : undefined
    if (ok) {
      next.typeProjet = tp
      report.typeProjetChange = true
      for (const f of getProjectType(tp)!.champs) {
        const added = addExtraField(next, { ...f, origine: 'type' }, now)
        if (added) report.champsAjoutes.push(added)
      }
    } else {
      report.rejected.push({ fieldId: 'typeProjet', raison: 'type de projet sans preuve' })
    }
  }

  // 3. Mises à jour, chacune prouvée par une citation.
  for (const u of patch.updates) {
    const def = getField(u.fieldId, next)
    if (!def) {
      report.rejected.push({ fieldId: u.fieldId, raison: 'champ inconnu' })
      continue
    }
    const preuves: Evidence[] = []
    for (const p of u.preuves) {
      const seg = findEvidence(segments, p.segmentId, p.citation)
      if (seg) preuves.push({ source: 'transcript', segmentId: seg.id, citation: p.citation.trim() })
    }
    if (preuves.length === 0) {
      report.rejected.push({ fieldId: u.fieldId, raison: 'aucune citation retrouvée dans le transcript' })
      continue
    }
    const current = next.champs[u.fieldId] ?? { status: 'manquant', preuves: [] }
    // Une info saisie par le commercial n'est jamais écrasée par le LLM.
    if (current.preuves.some((p) => p.source === 'saisie')) {
      report.rejected.push({ fieldId: u.fieldId, raison: 'champ verrouillé par une saisie manuelle' })
      continue
    }
    const items =
      def.type === 'liste'
        ? u.items
            .filter((i) => i.nom.trim())
            .map((i) => ({
              nom: i.nom.trim(),
              details: i.details?.trim() || undefined,
              attributs: i.attributs?.map((a) => a.trim()).filter(Boolean)
            }))
        : undefined
    const merged: FieldState = {
      status: u.status,
      valeur: u.valeur.trim() || current.valeur,
      items: items && items.length ? items : current.items,
      preuves: dedupeEvidence([...current.preuves, ...preuves]).slice(-MAX_PREUVES),
      majLe: now
    }
    next.champs[u.fieldId] = merged
    report.accepted.push(u.fieldId)
  }

  if (patch.resume?.trim()) next.resume = patch.resume.trim()
  next.version = brief.version + 1
  next.majLe = now
  return { brief: next, report }
}

function dedupeEvidence(list: Evidence[]): Evidence[] {
  const seen = new Set<string>()
  return list.filter((e) => {
    const key = `${e.source}:${'segmentId' in e ? e.segmentId : ''}:${normalize(e.citation)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const MAX_CHAMPS_IA = 8

/** Ajoute une info à la checklist (si elle n'existe pas déjà). Renvoie son id, ou undefined. */
export function addExtraField(
  brief: Brief,
  f: { id: string; label: string; description: string; groupe: ExtraFieldDef['groupe']; type: ExtraFieldDef['type']; origine: 'type' | 'ia' },
  now = Date.now()
): string | undefined {
  const id = f.id.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
  if (!id || !f.label.trim() || getField(id, brief)) return undefined
  // Pas de doublon de libellé avec une info existante.
  const label = f.label.trim()
  if (allFields(brief).some((x) => normalize(x.label) === normalize(label))) return undefined
  if (f.origine === 'ia' && brief.champsAjoutes.filter((x) => x.origine === 'ia').length >= MAX_CHAMPS_IA) return undefined
  brief.champsAjoutes.push({
    id,
    label,
    description: f.description.trim(),
    groupe: f.groupe,
    type: f.type,
    question: '',
    priorite: 2,
    maquette: f.groupe === 'fonctionnel' || f.groupe === 'utilisateurs',
    origine: f.origine,
    ajouteLe: now
  })
  brief.champs[id] = { status: 'manquant', preuves: [] }
  return id
}

/** Saisie manuelle par le commercial (verrouille le champ). */
export function setManualField(brief: Brief, fieldId: string, valeur: string, now = Date.now()): Brief {
  const next = normalizeBrief(structuredClone(brief))
  if (!next.champs[fieldId]) return brief
  if (!valeur.trim()) {
    next.champs[fieldId] = { status: 'manquant', preuves: [] }
  } else {
    next.champs[fieldId] = {
      status: 'obtenu',
      valeur: valeur.trim(),
      items: getField(fieldId, next)?.type === 'liste' ? valeur.split(/[,;\n]/).map((v) => ({ nom: v.trim() })).filter((i) => i.nom) : undefined,
      preuves: [{ source: 'saisie', citation: valeur.trim() }],
      majLe: now
    }
  }
  next.version++
  next.majLe = now
  return next
}

/** Infos issues du site web du prospect (nom, identité). */
export function applySiteInfo(
  brief: Brief,
  info: { url: string; nom?: string; identite?: string; secteur?: string },
  now = Date.now()
): Brief {
  const next = normalizeBrief(structuredClone(brief))
  const put = (fieldId: string, valeur: string | undefined, status: 'partiel' | 'obtenu') => {
    if (!valeur) return
    const cur = next.champs[fieldId]
    if (cur.status !== 'manquant') return
    next.champs[fieldId] = { status, valeur, preuves: [{ source: 'site', url: info.url, citation: valeur }], majLe: now }
  }
  put('entreprise_nom', info.nom, 'obtenu')
  put('identite', info.identite, 'obtenu')
  // Le secteur lu sur le site reste « partiel » : à confirmer pendant l'appel.
  put('secteur', info.secteur, 'partiel')
  next.version++
  next.majLe = now
  return next
}
