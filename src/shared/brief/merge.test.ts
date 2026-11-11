import { describe, expect, it } from 'vitest'
import type { TranscriptSegment } from '../types'
import { applyPatch, applySiteInfo, findEvidence, normalize, setManualField } from './merge'
import { type BriefPatch, emptyBrief, progress } from './schema'

const segs: TranscriptSegment[] = [
  { id: 'S1', speaker: 'commercial', startMs: 0, endMs: 4000, text: "Bonjour, merci de prendre le temps. Racontez-moi votre projet." },
  { id: 'S2', speaker: 'prospect', startMs: 4000, endMs: 12000, text: "Alors nous on gère une quarantaine de chantiers par an, et aujourd'hui tout est sur Excel." },
  { id: 'S3', speaker: 'prospect', startMs: 12000, endMs: 20000, text: "Pour chaque chantier on suit le chef de chantier, la date de début et le statut d'avancement." }
]

function patch(p: Partial<BriefPatch>): BriefPatch {
  return { updates: [], typeProjet: '', typeProjetPreuve: null, resume: '', questionsSuggerees: [], ...p }
}

describe('preuves', () => {
  it('normalise accents et ponctuation', () => {
    expect(normalize("Aujourd'hui, c'est l'ÉTÉ !")).toBe('aujourd hui c est l ete')
  })
  it('retrouve une citation exacte, ou dans un segment voisin', () => {
    expect(findEvidence(segs, 'S2', 'tout est sur Excel')?.id).toBe('S2')
    expect(findEvidence(segs, 'S3', 'tout est sur Excel')?.id).toBe('S2')
  })
  it('refuse une citation inventée', () => {
    expect(findEvidence(segs, 'S2', 'nous avons un budget de 80 000 euros')).toBeUndefined()
  })
  it('tolère une petite variation de la transcription', () => {
    expect(findEvidence(segs, 'S3', 'on suit le chef de chantier la date de debut et le statut avancement')?.id).toBe('S3')
  })
})

describe('applyPatch', () => {
  it('accepte une mise à jour prouvée et rejette une info devinée', () => {
    const { brief, report } = applyPatch(
      emptyBrief(),
      patch({
        updates: [
          { fieldId: 'entites', status: 'obtenu', valeur: 'Chantiers suivis', items: [{ nom: 'Chantier', details: '', attributs: ['chef de chantier', 'date de début', 'statut'] }], preuves: [{ segmentId: 'S3', citation: 'on suit le chef de chantier, la date de début et le statut' }] },
          { fieldId: 'budget', status: 'obtenu', valeur: '80 k€', items: [], preuves: [{ segmentId: 'S2', citation: 'budget de 80 000 euros' }] }
        ],
        typeProjet: 'app-metier',
        typeProjetPreuve: { segmentId: 'S2', citation: "aujourd'hui tout est sur Excel" }
      }),
      segs
    )
    expect(report.accepted).toEqual(['entites'])
    expect(report.rejected.map((r) => r.fieldId)).toEqual(['budget'])
    expect(brief.champs.entites.items?.[0].attributs).toContain('date de début')
    expect(brief.champs.budget.status).toBe('manquant')
    expect(brief.typeProjet).toBe('app-metier')
    expect(brief.questionsSuggerees.length).toBeGreaterThan(0)
  })
  it('refuse un type de projet hors catalogue', () => {
    const { brief } = applyPatch(emptyBrief(), patch({ typeProjet: 'fusée', typeProjetPreuve: { segmentId: 'S2', citation: 'tout est sur Excel' } }), segs)
    expect(brief.typeProjet).toBeNull()
  })
  it('ne remplace jamais une saisie manuelle', () => {
    const b = setManualField(emptyBrief(), 'budget', '50 à 70 k€')
    const { brief } = applyPatch(b, patch({ updates: [{ fieldId: 'budget', status: 'partiel', valeur: 'x', items: [], preuves: [{ segmentId: 'S2', citation: 'tout est sur Excel' }] }] }), segs)
    expect(brief.champs.budget.valeur).toBe('50 à 70 k€')
  })
  it('infos du site : nom obtenu, secteur seulement partiel', () => {
    const b = applySiteInfo(emptyBrief(), { url: 'https://exemple.fr', nom: 'Batiroc', secteur: 'Travaux publics' })
    expect(b.champs.entreprise_nom.status).toBe('obtenu')
    expect(b.champs.secteur.status).toBe('partiel')
    expect(progress(b).obtenu).toBe(1)
  })
})
