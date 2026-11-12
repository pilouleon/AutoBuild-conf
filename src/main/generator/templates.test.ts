import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { emptyBrief } from '@shared/brief/schema'
import { setManualField } from '@shared/brief/merge'
import { activePages, buildAppConfig } from '@shared/mockup/baseline'
import { listTemplates, sameProject, selectTemplate } from './templates'

const root = join(import.meta.dirname, '../../../templates')

describe('templates intégrés', () => {
  const all = listTemplates(root)
  const byId = (id: string) => all.find((t) => t.id === id)!

  it('les 4 templates étendent le socle et partagent son projet', () => {
    for (const id of ['erp', 'app-metier', 'extranet', 'intranet']) {
      const t = byId(id)
      expect(t, id).toBeDefined()
      expect(t.extends).toBe('socle')
      expect(sameProject(t, byId('socle'))).toBe(true)
      expect(t.pages.length).toBeGreaterThan(3)
    }
    expect(byId('extranet').layout).toBe('topnav')
  })

  it('choisit le template selon le type de projet, ou celui imposé', () => {
    const ready = all.map((t) => ({ ...t, ready: true }))
    expect(selectTemplate(ready, 'erp')?.id).toBe('erp')
    expect(selectTemplate(ready, 'planning-rdv')?.id).toBe('app-metier')
    expect(selectTemplate(ready, 'intranet')?.id).toBe('intranet')
    expect(selectTemplate(ready, 'erp', 'extranet')?.id).toBe('extranet')
    expect(selectTemplate(ready, null)?.id).toBe('socle')
  })

  it('active les pages optionnelles citées par le prospect (4 au plus)', () => {
    const erp = byId('erp')
    let brief = setManualField(emptyBrief(), 'modules', 'Devis, gestion des stocks multi-dépôts et facturation')
    const pages = activePages(erp, brief).map((p) => p.id)
    expect(pages).toEqual(expect.arrayContaining(['tableau', 'clients', 'devis', 'stocks', 'factures']))
    expect(pages).not.toContain('production')
    brief = setManualField(brief, 'processus', 'planning, reporting, droits, fournisseurs, production, commande, article, opportunité')
    expect(activePages(erp, brief).filter((p) => p.niveau === 'option').length).toBeLessThanOrEqual(4)
    const app = buildAppConfig({ brief, nomEntreprise: 'Acme', seed: 'acme', template: erp })
    expect(app.navigation.length).toBeLessThanOrEqual(12)
  })

  it('un portail commence par sa page d’accueil, en menu horizontal', () => {
    const app = buildAppConfig({ brief: emptyBrief(), nomEntreprise: 'Acme', seed: 'acme', template: byId('extranet') })
    expect(app.layout).toBe('topnav')
    expect(app.navigation[0]).toMatchObject({ type: 'page', cible: 'accueil-portail' })
    expect(app.navigation.some((n) => n.cible === 'parametres')).toBe(true)
  })
})
