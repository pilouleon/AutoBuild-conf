import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { NouveauRdvInput } from '@shared/types'
import { Store } from './store'

const input = (p: Partial<NouveauRdvInput> = {}): NouveauRdvInput => ({
  prospectNom: 'Ternovia',
  siteUrl: 'https://ternovia.fr',
  debut: '2026-11-20T09:30:00.000Z',
  dureeMin: 30,
  contexte: 'lead',
  notes: '',
  interlocuteurs: [{ nom: 'Claire Fontaine', fonction: 'DAF' }],
  templateChoisi: 'auto',
  ...p
})

describe('Store (données du poste)', () => {
  it('crée prospects et rendez-vous, regroupe les RDV d’un même prospect et les titre', () => {
    const dir = mkdtempSync(join(tmpdir(), 'store-'))
    const s = new Store(dir)
    const r1 = s.createRdv(input(), 'Léa')
    const r2 = s.createRdv(input({ prospectNom: 'ternovia ', repriseDe: r1.id, interlocuteurs: [{ nom: 'Marc Delaunay' }] }), 'Léa')
    expect(s.all().prospects).toHaveLength(1)
    expect(r1.titre).toBe('Premier rendez-vous')
    expect(r2.titre).toBe('Second rendez-vous')
    expect(s.prospect(r1.prospectId)!.interlocuteurs.map((c) => c.nom)).toEqual(['Claire Fontaine', 'Marc Delaunay'])
    s.flush()
    const again = new Store(dir)
    expect(again.all().rdvs).toHaveLength(2)
    expect(again.rdv(r2.id)!.repriseDe).toBe(r1.id)
  })

  it('remet d’aplomb un rendez-vous interrompu (application fermée en cours d’appel)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'store-'))
    const s = new Store(dir)
    const r = s.createRdv(input(), 'Léa')
    s.updateRdv(r.id, (x) => {
      x.statut = 'en_cours'
      x.transcript = [{ id: 'S1', speaker: 'prospect', startMs: 0, endMs: 1000, text: 'Bonjour' }]
    })
    s.flush()
    expect(new Store(dir).rdv(r.id)!.statut).toBe('termine')
  })

  it('met de côté un fichier illisible au lieu de l’écraser', () => {
    const dir = mkdtempSync(join(tmpdir(), 'store-'))
    writeFileSync(join(dir, 'donnees.json'), '{ pas du json')
    const s = new Store(dir)
    expect(s.all().rdvs).toEqual([])
    expect(readdirSync(dir).some((f) => f.startsWith('donnees.json.illisible-'))).toBe(true)
    s.createRdv(input(), 'Léa')
    s.flush()
    expect(JSON.parse(readFileSync(join(dir, 'donnees.json'), 'utf8')).rdvs).toHaveLength(1)
    expect(existsSync(join(dir, 'donnees.json.tmp'))).toBe(false)
  })
})
