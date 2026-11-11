import { describe, expect, it } from 'vitest'
import { emptyBrief } from '../brief/schema'
import { buildAppConfig, inferFieldType } from './baseline'

function brief() {
  const b = emptyBrief()
  b.typeProjet = 'app-metier'
  b.champs.entites = { status: 'obtenu', preuves: [], items: [{ nom: 'chantier', attributs: ['chef de chantier', 'date de début', 'statut d’avancement', 'montant du marché', 'client'] }] }
  b.champs.modules = { status: 'obtenu', preuves: [], items: [{ nom: 'Devis' }, { nom: 'Facturation' }] }
  b.champs.roles = { status: 'obtenu', preuves: [], items: [{ nom: 'Conducteur de travaux' }, { nom: 'Direction' }] }
  b.champs.indicateurs = { status: 'partiel', preuves: [], items: [{ nom: 'Marge par chantier' }] }
  return b
}

describe('buildAppConfig', () => {
  it('reprend les objets, champs et rôles cités', () => {
    const app = buildAppConfig({ brief: brief(), nomEntreprise: 'Batiroc', seed: 'batiroc' })
    expect(app.titre.startsWith('Batiroc ')).toBe(true)
    const chantier = app.entites.find((e) => e.id === 'chantier')!
    expect(chantier.labelPluriel).toBe('Chantiers')
    const labels = chantier.champs.map((c) => c.label)
    expect(labels).toContain('Chef de chantier')
    expect(chantier.champs.find((c) => c.label === 'Date de début')?.type).toBe('date')
    expect(chantier.champs.find((c) => c.label === 'Montant du marché')?.type).toBe('euro')
    expect(chantier.donnees.length).toBeGreaterThanOrEqual(12)
    expect(app.entites.map((e) => e.id)).toEqual(expect.arrayContaining(['devis', 'facture']))
    expect(app.entites.find((e) => e.id === 'facture')?.feminin).toBe(true)
    expect(app.roles.map((r) => r.label)).toEqual(['Conducteur de travaux', 'Direction'])
    expect(app.tableauDeBord.kpis[0].label).toBe('Marge par chantier')
    expect(app.navigation[0].type).toBe('tableau-de-bord')
  })
  it('est déterministe (la maquette ne change pas à chaque mise à jour)', () => {
    const a = buildAppConfig({ brief: brief(), nomEntreprise: 'Batiroc', seed: 'batiroc' })
    const b = buildAppConfig({ brief: brief(), nomEntreprise: 'Batiroc', seed: 'batiroc' })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
  it('complète avec le catalogue quand le brief est vide', () => {
    const app = buildAppConfig({ brief: emptyBrief(), nomEntreprise: 'X', seed: 'x' })
    expect(app.entites.length).toBeGreaterThanOrEqual(2)
  })
  it('devine les types de champs', () => {
    expect(inferFieldType('date de livraison').type).toBe('date')
    expect(inferFieldType('prix unitaire').type).toBe('euro')
    expect(inferFieldType('technicien affecté').type).toBe('personne')
    expect(inferFieldType('client', ['Client']).type).toBe('reference')
    expect(inferFieldType('taux de remplissage').type).toBe('pourcent')
  })
})
