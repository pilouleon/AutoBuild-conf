// Reporting : analyses construites automatiquement à partir des entités (répartition par statut,
// montants par mois, classement), avec filtre de période.
import { useState } from 'react'
import { BarChart, DonutChart, LineChart } from '../../components/charts'
import { Button, Card, CardHeader, PageHeader, Select } from '../../components/ui'
import { formatValue } from '../../lib/format'
import { useRows } from '../../lib/store'
import { app } from '../../mockup'
import type { Entity } from '../../mockup/types'
import { type LibraryPageProps, fieldOf, pickEntity, titleOf } from './data'

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']

export function Reporting({ source }: LibraryPageProps) {
  const [entityId, setEntityId] = useState(pickEntity(source, (e) => e.champs.some((f) => f.type === 'euro'))?.id ?? '')
  const entity = app.entites.find((e) => e.id === entityId)
  return (
    <div>
      <PageHeader
        title="Reporting"
        subtitle="Analyses mises à jour en temps réel à partir des données de l’application."
        actions={
          <>
            <Select value={entityId} onChange={(e) => setEntityId(e.target.value)} className="w-52">
              {app.entites.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.labelPluriel}
                </option>
              ))}
            </Select>
            <Button variant="outline" icon="download">
              Export Excel
            </Button>
          </>
        }
      />
      {entity ? <Analyse key={entity.id} entity={entity} /> : null}
    </div>
  )
}

function Analyse({ entity }: { entity: Entity }) {
  const rows = useRows(entity.id)
  const montant = fieldOf(entity, (f) => f.type === 'euro')
  const date = entity.champDate ? entity.champs.find((f) => f.id === entity.champDate) : fieldOf(entity, (f) => f.type === 'date')
  const statut = entity.champStatut ? entity.champs.find((f) => f.id === entity.champStatut) : fieldOf(entity, (f) => f.type === 'statut' || f.type === 'choix')
  const groupe = fieldOf(entity, (f) => (f.type === 'personne' || f.type === 'reference' || f.type === 'choix') && f.id !== statut?.id)

  const parStatut = statut ? countBy(rows.map((r) => String(r[statut.id] ?? '—'))) : []
  const valeurDe = (r: Record<string, unknown>) => (montant ? Number(r[montant.id]) || 0 : 1)
  const parMois: { label: string; valeur: number }[] = []
  if (date) {
    const acc = new Map<string, number>()
    for (const r of rows) {
      const d = new Date(String(r[date.id]))
      if (Number.isNaN(d.getTime())) continue
      const k = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
      acc.set(k, (acc.get(k) ?? 0) + valeurDe(r))
    }
    for (const [k, v] of [...acc.entries()].sort()) parMois.push({ label: MOIS[Number(k.slice(5))], valeur: Math.round(v) })
  }
  const parGroupe = groupe ? sumBy(rows, (r) => String(r[groupe.id] ?? '—'), valeurDe).slice(0, 6) : []
  const total = rows.reduce((s, r) => s + valeurDe(r), 0)
  const top = montant ? [...rows].sort((a, b) => valeurDe(b) - valeurDe(a)).slice(0, 5) : []
  const fmt = montant ? 'euro' : 'nombre'

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-slate-500">{entity.labelPluriel}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{rows.length}</p>
        </Card>
        {montant && (
          <Card className="p-5">
            <p className="text-sm text-slate-500">{montant.label} (total)</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatValue(Math.round(total), 'euro')}</p>
          </Card>
        )}
        {montant && rows.length > 0 && (
          <Card className="p-5">
            <p className="text-sm text-slate-500">{montant.label} (moyenne)</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatValue(Math.round(total / rows.length), 'euro')}</p>
          </Card>
        )}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {parMois.length > 1 && (
          <Card>
            <CardHeader title={montant ? `${montant.label} par mois` : `${entity.labelPluriel} par mois`} />
            <div className="p-5">
              <LineChart data={parMois} format={fmt} />
            </div>
          </Card>
        )}
        {parStatut.length > 0 && (
          <Card>
            <CardHeader title={`Répartition par ${statut!.label.toLowerCase()}`} />
            <div className="p-5">
              <DonutChart data={parStatut} />
            </div>
          </Card>
        )}
        {parGroupe.length > 1 && (
          <Card>
            <CardHeader title={`${montant ? montant.label : entity.labelPluriel} par ${groupe!.label.toLowerCase()}`} />
            <div className="p-5">
              <BarChart data={parGroupe} format={fmt} />
            </div>
          </Card>
        )}
        {top.length > 0 && (
          <Card>
            <CardHeader title={`Top 5 — ${montant!.label.toLowerCase()}`} />
            <ul className="divide-y divide-slate-100">
              {top.map((r, i) => (
                <li key={String(r.id)} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className="w-5 text-xs font-semibold text-slate-400">{i + 1}</span>
                  <span className="flex-1 truncate font-medium text-slate-800">{titleOf(entity, r)}</span>
                  <span className="font-semibold tabular-nums text-slate-900">{formatValue(valeurDe(r), 'euro')}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  )
}

function countBy(values: string[]): { label: string; valeur: number }[] {
  const m = new Map<string, number>()
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1)
  return [...m.entries()].map(([label, valeur]) => ({ label, valeur })).sort((a, b) => b.valeur - a.valeur)
}

function sumBy<T>(rows: T[], key: (r: T) => string, val: (r: T) => number): { label: string; valeur: number }[] {
  const m = new Map<string, number>()
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + val(r))
  return [...m.entries()].map(([label, valeur]) => ({ label, valeur: Math.round(valeur) })).sort((a, b) => b.valeur - a.valeur)
}
