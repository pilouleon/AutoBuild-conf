import { describe, expect, it } from 'vitest'
import type { TranscriptSegment } from '../types'
import { applyPatch, applySiteInfo, findEvidence, normalize, setManualField } from './merge'
import { type BriefPatch, checklist, emptyBrief, progress } from './schema'

const segs: TranscriptSegment[] = [
  { id: 'S1', speaker: 'commercial', startMs: 0, endMs: 4000, text: "Bonjour, merci de prendre le temps. Racontez-moi votre projet." },
  { id: 'S2', speaker: 'prospect', startMs: 4000, endMs: 12000, text: "Alors nous on gère une quarantaine de chantiers par an, et aujourd'hui tout est sur Excel." },
  { id: 'S3', speaker: 'prospect', startMs: 12000, endMs: 20000, text: "Pour chaque chantier on suit le chef de chantier, la date de début et le statut d'avancement." }
]

function patch(p: Partial<BriefPatch>): BriefPatch {
  return { nouveauxChamps: [], updates: [], typeProjet: '', typeProjetPreuve: null, resume: '', ...p }
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
    // Le type de projet ajoute ses propres infos à obtenir.
    expect(brief.champsAjoutes.map((f) => f.id)).toContain('metier_validation')
    expect(brief.champs.metier_validation.status).toBe('manquant')
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

describe('infos ajoutées en cours de rendez-vous', () => {
  it('ajoute une info demandée par l’IA et la remplit seulement avec une preuve', () => {
    const { brief, report } = applyPatch(
      emptyBrief(),
      patch({
        nouveauxChamps: [{ id: 'nb_chantiers_an', label: 'Chantiers par an', description: 'Volume annuel', groupe: 'entreprise', type: 'texte' }],
        updates: [{ fieldId: 'nb_chantiers_an', status: 'obtenu', valeur: 'Une quarantaine', items: [], preuves: [{ segmentId: 'S2', citation: 'on gère une quarantaine de chantiers par an' }] }]
      }),
      segs
    )
    expect(report.champsAjoutes).toEqual(['nb_chantiers_an'])
    expect(report.accepted).toContain('nb_chantiers_an')
    expect(brief.champs.nb_chantiers_an.status).toBe('obtenu')
    expect(brief.champsAjoutes[0].origine).toBe('ia')
  })
  it('ne crée pas deux fois la même info, ni une info de la grille', () => {
    const p = patch({ nouveauxChamps: [{ id: 'budget', label: 'Budget', description: '', groupe: 'commercial', type: 'texte' }, { id: 'x1', label: 'Saisies hors ligne', description: '', groupe: 'technique', type: 'texte' }, { id: 'x2', label: 'saisies hors ligne', description: '', groupe: 'technique', type: 'texte' }] })
    const { brief } = applyPatch(emptyBrief(), p, segs)
    expect(brief.champsAjoutes.map((f) => f.label)).toEqual(['Saisies hors ligne'])
  })
})

describe('checklist', () => {
  it('met les infos obtenues en haut (dans l’ordre d’obtention) et les manquantes en bas', () => {
    let b = setManualField(emptyBrief(), 'budget', '50 k€', 1000)
    b = setManualField(b, 'delai', 'Septembre', 2000)
    const { obtenus, manquants } = checklist(b)
    expect(obtenus.map((i) => i.id)).toEqual(['budget', 'delai'])
    expect(manquants.length).toBe(progress(b).total - 2)
    expect(manquants.some((i) => i.id === 'budget')).toBe(false)
  })
})
