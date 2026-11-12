// Suivi des étapes : chaque élément avec sa progression dans le circuit (statuts dans l'ordre), et les
// éléments en attente d'action. Cliquer sur une étape fait avancer l'élément (démo).
import { useState } from 'react'
import { Icon } from '../../components/icons'
import { Badge, Card, CardHeader, PageHeader, Select, cn, statusColor } from '../../components/ui'
import { formatDate } from '../../lib/format'
import { navigate } from '../../lib/router'
import { updateRow, useRows } from '../../lib/store'
import { app } from '../../mockup'
import { type LibraryPageProps, fieldOf, pickEntity, titleOf } from './data'

export function Suivi({ source }: LibraryPageProps) {
  const entity = pickEntity(source, (e) => !!e.champStatut && (e.champs.find((f) => f.id === e.champStatut)?.options?.length ?? 0) >= 3)
  const rows = useRows(entity?.id ?? '')
  const statut = entity?.champStatut ? entity.champs.find((f) => f.id === entity.champStatut) : undefined
  // Les états « hors circuit » (retard, blocage, annulation) ne sont pas des étapes.
  const etapes = (statut?.options ?? []).filter((o) => !/annul|refus|perdu|retard|bloqu|suspendu|litige/i.test(o))
  const personne = fieldOf(entity, (f) => f.type === 'personne')
  const date = entity?.champDate ? entity.champs.find((f) => f.id === entity.champDate) : undefined
  const [filtre, setFiltre] = useState('')
  const nav = app.navigation.find((n) => n.type === 'entite' && n.cible === entity?.id)

  if (!entity || !statut || etapes.length < 2)
    return (
      <div>
        <PageHeader title="Suivi des étapes" />
        <Card className="p-10 text-center text-sm text-slate-500">Aucun circuit à suivre pour le moment.</Card>
      </div>
    )

  const visibles = rows.filter((r) => !filtre || r[statut.id] === filtre)
  const parEtape = etapes.map((e) => ({ e, n: rows.filter((r) => r[statut.id] === e).length }))

  return (
    <div>
      <PageHeader
        title={`Suivi des ${entity.labelPluriel.toLowerCase()}`}
        subtitle={`Avancement de chaque ${entity.label.toLowerCase()} dans le circuit : ${etapes.join(' → ')}.`}
        actions={
          <Select value={filtre} onChange={(e) => setFiltre(e.target.value)} className="w-56">
            <option value="">Toutes les étapes</option>
            {etapes.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </Select>
        }
      />
      <div className="mb-6 grid gap-3" style={{ gridTemplateColumns: `repeat(${etapes.length}, minmax(0, 1fr))` }}>
        {parEtape.map(({ e, n }, i) => (
          <button key={e} onClick={() => setFiltre(filtre === e ? '' : e)} className={cn('relative rounded-xl border bg-white p-4 text-left shadow-sm transition', filtre === e ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200 hover:border-slate-300')}>
            <p className="text-xs font-medium text-slate-500">
              Étape {i + 1}
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{e}</p>
            <p className="mt-2 text-2xl font-semibold text-primary">{n}</p>
          </button>
        ))}
      </div>
      <Card>
        <CardHeader title={`${visibles.length} ${visibles.length > 1 ? entity.labelPluriel.toLowerCase() : entity.label.toLowerCase()}`} subtitle="Cliquez sur l’étape suivante pour faire avancer un élément." />
        <ul className="divide-y divide-slate-100">
          {visibles.map((r) => {
            const s = String(r[statut.id] ?? '')
            const idx = etapes.indexOf(s)
            return (
              <li key={String(r.id)} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="w-64 min-w-0">
                  <button onClick={() => nav && navigate(`${nav.id}/${r.id}`)} className="truncate text-left text-sm font-medium text-slate-900 hover:text-primary">
                    {titleOf(entity, r)}
                  </button>
                  <p className="truncate text-xs text-slate-500">
                    {[personne && r[personne.id], date && r[date.id] && formatDate(String(r[date.id]))].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex flex-1 items-center">
                  {etapes.map((e, i) => (
                    <div key={e} className="flex flex-1 items-center last:flex-none">
                      <button
                        title={e}
                        onClick={() => updateRow(entity.id, String(r.id), { [statut.id]: e })}
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition',
                          idx === -1 ? 'bg-slate-100 text-slate-400' : i < idx ? 'bg-primary text-primary-fg' : i === idx ? 'bg-primary/15 text-primary ring-2 ring-primary' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                        )}
                      >
                        {i < idx ? <Icon name="check" className="h-3.5 w-3.5" /> : i + 1}
                      </button>
                      {i < etapes.length - 1 && <div className={cn('mx-1 h-0.5 flex-1 rounded', i < idx ? 'bg-primary' : 'bg-slate-200')} />}
                    </div>
                  ))}
                </div>
                <div className="w-36 text-right">
                  <Badge color={statusColor(s, statut.couleurs)}>{s || '—'}</Badge>
                </div>
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
