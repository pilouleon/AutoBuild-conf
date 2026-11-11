// Application d'un patch du LLM au brief, avec vérification des preuves.
// Une mise à jour sans citation retrouvable dans le transcript est REJETÉE :
// c'est ce qui garantit la règle « une info manquante n'est jamais devinée ».

import type { TranscriptSegment } from '../types'
import { getProjectType } from '../catalog'
import { type Brief, type BriefPatch, type Evidence, type FieldState, getField } from './schema'

export interface MergeReport {
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
  const next: Brief = structuredClone(brief)
  const report: MergeReport = { accepted: [], rejected: [], typeProjetChange: false }

  for (const u of patch.updates) {
    const def = getField(u.fieldId)
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

  // Type de projet : uniquement un id du catalogue, avec une preuve valide.
  const tp = patch.typeProjet?.trim()
  if (tp && tp !== next.typeProjet && getProjectType(tp)) {
    const p = patch.typeProjetPreuve
    const ok = p ? findEvidence(segments, p.segmentId, p.citation) : undefined
    if (ok) {
      next.typeProjet = tp
      report.typeProjetChange = true
    } else {
      report.rejected.push({ fieldId: 'typeProjet', raison: 'type de projet sans preuve' })
    }
  }

  if (patch.resume?.trim()) next.resume = patch.resume.trim()
  next.questionsSuggerees = patch.questionsSuggerees
    .filter((q) => next.champs[q.fieldId] && next.champs[q.fieldId].status !== 'obtenu' && q.question.trim())
    .slice(0, 3)
  if (next.questionsSuggerees.length === 0) next.questionsSuggerees = defaultQuestions(next)
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

/** Questions par défaut : les champs prioritaires encore manquants, dans l'ordre de la grille. */
export function defaultQuestions(brief: Brief): { fieldId: string; question: string }[] {
  const out: { fieldId: string; question: string }[] = []
  for (const prio of [1, 2, 3] as const) {
    for (const id of Object.keys(brief.champs)) {
      const def = getField(id)
      if (!def || def.priorite !== prio) continue
      if (brief.champs[id].status === 'manquant') out.push({ fieldId: id, question: def.question })
      if (out.length >= 3) return out
    }
  }
  return out
}

/** Saisie manuelle par le commercial (verrouille le champ). */
export function setManualField(brief: Brief, fieldId: string, valeur: string, now = Date.now()): Brief {
  const next = structuredClone(brief)
  if (!next.champs[fieldId]) return brief
  if (!valeur.trim()) {
    next.champs[fieldId] = { status: 'manquant', preuves: [] }
  } else {
    next.champs[fieldId] = {
      status: 'obtenu',
      valeur: valeur.trim(),
      items: getField(fieldId)?.type === 'liste' ? valeur.split(/[,;\n]/).map((v) => ({ nom: v.trim() })).filter((i) => i.nom) : undefined,
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
  const next = structuredClone(brief)
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
