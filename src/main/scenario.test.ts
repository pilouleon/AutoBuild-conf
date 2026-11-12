import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyPatch } from '@shared/brief/merge'
import { emptyBrief, progress } from '@shared/brief/schema'
import { buildAppConfig } from '@shared/mockup/baseline'
import type { TranscriptSegment } from '@shared/types'
import { extractBrand } from './brand/extract'
import { listScenarios, loadScenario } from './transcription/scenario'

const root = join(__dirname, '..', '..', 'scenarios')

describe('scénarios de démonstration', () => {
  it('sont listés', () => {
    expect(listScenarios(root).map((s) => s.id)).toContain('ternovia-chantiers')
  })

  it('toutes les preuves des patchs sont retrouvées dans le transcript', () => {
    const sc = loadScenario(join(root, 'ternovia-chantiers'))
    const segments: TranscriptSegment[] = sc.segments.map((s, i) => ({ id: `S${i + 1}`, speaker: s.speaker, startMs: s.t * 1000, endMs: (s.t + s.d) * 1000, text: s.text }))
    let brief = emptyBrief()
    for (const p of sc.briefPatches) {
      const res = applyPatch(brief, p.patch, segments.slice(0, p.apresSegment))
      expect(res.report.rejected, `patch après S${p.apresSegment}`).toEqual([])
      brief = res.brief
    }
    expect(brief.typeProjet).toBe('app-metier')
    // Sans les infos du site (ajoutées à la préparation), le brief est rempli aux trois quarts.
    expect(progress(brief).pct).toBeGreaterThanOrEqual(75)
    // Infos ajoutées en cours de route : celles du type de projet et celles demandées par l'IA.
    expect(brief.champsAjoutes.map((f) => f.id)).toEqual(expect.arrayContaining(['metier_validation', 'nb_chantiers_an', 'saisies_hors_ligne']))
    expect(brief.champs.nb_chantiers_an.status).toBe('obtenu')
    const app = buildAppConfig({ brief, nomEntreprise: 'Ternovia', seed: 'ternovia' })
    expect(app.entites.map((e) => e.label)).toEqual(expect.arrayContaining(['Chantier', 'Pointage', 'Engin', 'Situation de travaux']))
  })

  it("extrait l'identité du faux site (nom, logo, couleurs, police)", async () => {
    const sc = loadScenario(join(root, 'ternovia-chantiers'))
    const res = await extractBrand(sc.prospect.url, { destDir: mkdtempSync(join(tmpdir(), 'marque-')) })
    expect(res.brand.nomEntreprise).toBe('Ternovia')
    expect(res.brand.couleurs.primaire.toLowerCase()).toBe('#e4572e')
    expect(res.brand.couleurs.secondaire?.toLowerCase()).toBe('#1d3557')
    expect(res.brand.logoPath).toMatch(/logo\.svg$/)
    expect(res.brand.police).toBe('Montserrat')
    expect(res.siteText).toContain('Voirie et aménagements urbains')
  })
})
