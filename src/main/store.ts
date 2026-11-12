// Données enregistrées sur le poste du commercial : prospects et rendez-vous (JSON).
// Écriture atomique (fichier temporaire puis renommage) et regroupée (débounce).

import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { emptyBrief, normalizeBrief } from '@shared/brief/schema'
import type { AppData, NouveauRdvInput, PreparationEtape, Prospect, Rdv } from '@shared/types'

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`
}

export function etapesInitiales(): PreparationEtape[] {
  return [
    { id: 'identite', label: 'Identité visuelle', statut: 'attente' },
    { id: 'template', label: 'Template', statut: 'attente' },
    { id: 'maquette', label: 'Maquette de départ', statut: 'attente' },
    { id: 'planb', label: 'Plan B', statut: 'attente' }
  ]
}

function normalizeName(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
}

export class Store {
  private file: string
  private data: AppData = { prospects: [], rdvs: [] }
  private timer?: ReturnType<typeof setTimeout>

  constructor(
    dir: string,
    private onChange: (d: AppData) => void = () => {}
  ) {
    mkdirSync(dir, { recursive: true })
    this.file = join(dir, 'donnees.json')
    if (existsSync(this.file)) {
      try {
        const raw = JSON.parse(readFileSync(this.file, 'utf8')) as AppData
        this.data = {
          prospects: raw.prospects ?? [],
          rdvs: (raw.rdvs ?? []).map((r) => ({ ...r, brief: normalizeBrief(r.brief), maquette: { ...r.maquette, steps: r.maquette?.steps ?? [], versions: r.maquette?.versions ?? [] } }))
        }
      } catch {
        // Fichier illisible : on le met de côté plutôt que de l'écraser.
        renameSync(this.file, `${this.file}.illisible-${Date.now()}`)
      }
    }
    // Un RDV « en cours » ou « en préparation » au démarrage a été interrompu (application fermée).
    for (const r of this.data.rdvs) {
      if (r.statut === 'en_cours') r.statut = r.transcript.length ? 'termine' : 'pret'
      if (r.statut === 'preparation') r.statut = 'a_preparer'
    }
  }

  all(): AppData {
    return this.data
  }

  rdv(id: string): Rdv | undefined {
    return this.data.rdvs.find((r) => r.id === id)
  }

  prospect(id: string): Prospect | undefined {
    return this.data.prospects.find((p) => p.id === id)
  }

  rdvsOf(prospectId: string): Rdv[] {
    return this.data.rdvs.filter((r) => r.prospectId === prospectId).sort((a, b) => a.debut.localeCompare(b.debut))
  }

  findProspectByName(nom: string): Prospect | undefined {
    const n = normalizeName(nom)
    return this.data.prospects.find((p) => normalizeName(p.nom) === n)
  }

  upsertProspect(p: Partial<Prospect> & { nom: string }): Prospect {
    const now = Date.now()
    const existing = (p.id && this.prospect(p.id)) || this.findProspectByName(p.nom)
    if (existing) {
      Object.assign(existing, { ...p, id: existing.id, majLe: now, interlocuteurs: p.interlocuteurs?.length ? mergeContacts(existing.interlocuteurs, p.interlocuteurs) : existing.interlocuteurs })
      this.save()
      return existing
    }
    const created: Prospect = { id: newId('pro'), nom: p.nom.trim(), siteUrl: p.siteUrl, secteur: p.secteur, interlocuteurs: p.interlocuteurs ?? [], brand: p.brand, notes: p.notes, creeLe: now, majLe: now }
    this.data.prospects.push(created)
    this.save()
    return created
  }

  createRdv(input: NouveauRdvInput, commercial: string, extra: Partial<Rdv> = {}): Rdv {
    const prospect = this.upsertProspect({ id: input.prospectId, nom: input.prospectNom, siteUrl: input.siteUrl || undefined, interlocuteurs: input.interlocuteurs })
    const precedents = this.rdvsOf(prospect.id).length
    const now = Date.now()
    const rdv: Rdv = {
      id: newId('rdv'),
      prospectId: prospect.id,
      titre: precedents === 0 ? 'Premier rendez-vous' : precedents === 1 ? 'Second rendez-vous' : `Rendez-vous n° ${precedents + 1}`,
      debut: input.debut,
      dureeMin: input.dureeMin,
      lienVisio: input.lienVisio || undefined,
      contexte: input.contexte,
      notes: input.notes,
      commercial,
      interlocuteurs: input.interlocuteurs.filter((c) => c.nom.trim()),
      templateChoisi: input.templateChoisi || 'auto',
      statut: 'a_preparer',
      preparation: { etapes: etapesInitiales() },
      brief: emptyBrief(),
      transcript: [],
      maquette: { steps: [], versions: [] },
      repriseDe: input.repriseDe,
      creeLe: now,
      majLe: now,
      ...extra
    }
    this.data.rdvs.push(rdv)
    this.save()
    return rdv
  }

  updateRdv(id: string, fn: (r: Rdv) => void): Rdv | undefined {
    const r = this.rdv(id)
    if (!r) return undefined
    fn(r)
    r.majLe = Date.now()
    this.save()
    return r
  }

  updateProspect(id: string, fn: (p: Prospect) => void): Prospect | undefined {
    const p = this.prospect(id)
    if (!p) return undefined
    fn(p)
    p.majLe = Date.now()
    this.save()
    return p
  }

  deleteRdv(id: string): void {
    this.data.rdvs = this.data.rdvs.filter((r) => r.id !== id)
    this.save()
  }

  /** Enregistrement regroupé (évite d'écrire 10 fois par seconde pendant un RDV). */
  save(immediate = false): void {
    if (immediate) return this.flush()
    // Regroupement : une écriture au plus toutes les 400 ms, même si les modifications sont continues.
    if (!this.timer) this.timer = setTimeout(() => this.flush(), 400)
  }

  flush(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = undefined
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.data), 'utf8')
    renameSync(tmp, this.file)
    this.onChange(this.data)
  }
}

function mergeContacts(a: Prospect['interlocuteurs'], b: Prospect['interlocuteurs']): Prospect['interlocuteurs'] {
  const out = [...a]
  for (const c of b) if (c.nom.trim() && !out.some((x) => normalizeName(x.nom) === normalizeName(c.nom))) out.push(c)
  return out
}
