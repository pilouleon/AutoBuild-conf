// Planning de la semaine : une ligne par personne (ou ressource), les éléments datés placés sur les jours.
import { useMemo, useState } from 'react'
import { Icon } from '../../components/icons'
import { Badge, Button, Card, PageHeader, Tabs, cn, statusColor } from '../../components/ui'
import { navigate } from '../../lib/router'
import { useRows } from '../../lib/store'
import { app } from '../../mockup'
import { type LibraryPageProps, type Row, addDays, fieldOf, isoDay, mondayOf, people, pickEntity, titleOf } from './data'

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']

export function Planning({ source }: LibraryPageProps) {
  const entity = pickEntity(source, (e) => !!e.champDate && e.champs.some((f) => f.type === 'personne'))
  const rows = useRows(entity?.id ?? '')
  const dateField = entity?.champDate ?? fieldOf(entity, (f) => f.type === 'date')?.id
  // Date de fin (chantier, mission…) : l'élément occupe alors tous les jours entre début et fin.
  const endField = fieldOf(entity, (f) => f.type === 'date' && f.id !== dateField && /fin|échéance|echeance|livraison|retour/i.test(`${f.id} ${f.label}`))?.id
  const personField = fieldOf(entity, (f) => f.type === 'personne')?.id
  const statusField = entity?.champStatut
  const span = (r: Row): [string, string] | null => {
    const a = dateField ? r[dateField] : null
    if (typeof a !== 'string') return null
    const b = endField && typeof r[endField] === 'string' && String(r[endField]) >= a ? String(r[endField]) : a
    // Un élément très long (plusieurs mois) n'est affiché que sur ses deux premières semaines.
    const max = isoDay(addDays(new Date(a), 13))
    return [isoDay(new Date(a)), b < max ? isoDay(new Date(b)) : max]
  }
  const onDay = (r: Row, day: string) => {
    const sp = span(r)
    return !!sp && sp[0] <= day && day <= sp[1]
  }

  // Semaine affichée : celle (du lundi au vendredi) qui contient le plus d'éléments.
  const initial = useMemo(() => {
    let best = { monday: mondayOf(new Date()), n: -1 }
    const candidates = new Set<string>([isoDay(mondayOf(new Date()))])
    for (const r of rows) {
      const sp = span(r)
      if (sp) candidates.add(isoDay(mondayOf(new Date(sp[0]))))
    }
    for (const c of candidates) {
      const monday = new Date(c)
      const days = [0, 1, 2, 3, 4].map((i) => isoDay(addDays(monday, i)))
      const n = rows.reduce((acc, r) => acc + days.filter((d) => onDay(r, d)).length, 0)
      if (n > best.n) best = { monday, n }
    }
    return best.monday
  }, [rows, dateField, endField])
  const [offset, setOffset] = useState(0)
  const [vue, setVue] = useState<'personnes' | 'liste'>('personnes')
  const monday = addDays(mondayOf(initial), offset * 7)
  const days = JOURS.map((_, i) => addDays(monday, i))

  const inWeek = rows.filter((r) => days.some((d) => onDay(r, isoDay(d))))
  const lignes = personField ? [...new Set([...inWeek.map((r) => String(r[personField] ?? 'Non affecté')), ...people(5).slice(0, 4)])] : ['Tous']
  const nav = app.navigation.find((n) => n.type === 'entite' && n.cible === entity?.id)

  const fin = days[4].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const debut = days[0].toLocaleDateString('fr-FR', { day: 'numeric', month: days[0].getMonth() === days[4].getMonth() ? undefined : 'long' })

  return (
    <div>
      <PageHeader
        title="Planning"
        subtitle={entity ? `${entity.labelPluriel} de la semaine, par ${personField ? 'personne' : 'jour'}.` : 'Planning de la semaine.'}
        actions={
          <>
            <Tabs value={vue} onChange={setVue} options={[{ value: 'personnes', label: 'Par personne', icon: 'users' }, { value: 'liste', label: 'Liste', icon: 'list' }]} />
            {nav && (
              <Button icon="plus" onClick={() => navigate(`${nav.id}/nouveau`)}>
                {entity?.feminin ? 'Nouvelle' : 'Nouveau'} {entity?.label.toLowerCase()}
              </Button>
            )}
          </>
        }
      />
      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-1">
            <button onClick={() => setOffset(offset - 1)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" title="Semaine précédente">
              <Icon name="chevronLeft" className="h-4 w-4" />
            </button>
            <button onClick={() => setOffset(offset + 1)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" title="Semaine suivante">
              <Icon name="chevronRight" className="h-4 w-4" />
            </button>
            <p className="ml-2 text-sm font-semibold text-slate-900">
              Semaine du {debut} au {fin}
            </p>
          </div>
          <p className="text-xs text-slate-500">{inWeek.length} élément{inWeek.length > 1 ? 's' : ''} cette semaine</p>
        </div>
        {vue === 'personnes' ? (
          <div className="overflow-x-auto">
            <div className="grid min-w-[860px]" style={{ gridTemplateColumns: '180px repeat(5, minmax(0, 1fr))' }}>
              <div className="border-b border-slate-100 bg-slate-50/60" />
              {days.map((d, i) => (
                <div key={i} className={cn('border-b border-l border-slate-100 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-500', isoDay(d) === isoDay(new Date()) && 'text-primary')}>
                  {JOURS[i]} <span className="text-slate-400">{d.getDate()}</span>
                </div>
              ))}
              {lignes.map((p) => (
                <Ligne key={p} p={p} days={days} rows={inWeek} onDay={onDay} personField={personField} statusField={statusField} title={(r) => (entity ? titleOf(entity, r) : '')} open={(r) => nav && navigate(`${nav.id}/${r.id}`)} />
              ))}
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {inWeek.length === 0 && <li className="px-5 py-10 text-center text-sm text-slate-500">Rien de prévu cette semaine.</li>}
            {[...inWeek]
              .sort((a, b) => String(a[dateField!]).localeCompare(String(b[dateField!])))
              .map((r) => (
                <li key={String(r.id)} onClick={() => nav && navigate(`${nav.id}/${r.id}`)} className="flex cursor-pointer items-center gap-4 px-5 py-3 hover:bg-slate-50">
                  <span className="w-28 text-xs font-medium text-slate-500">{new Date(String(r[dateField!])).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })}</span>
                  <span className="flex-1 text-sm font-medium text-slate-900">{entity && titleOf(entity, r)}</span>
                  {personField && <span className="text-sm text-slate-500">{String(r[personField] ?? '')}</span>}
                  {statusField && r[statusField] && <Badge color={statusColor(String(r[statusField]))}>{String(r[statusField])}</Badge>}
                </li>
              ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function Ligne({ p, days, rows, onDay, personField, statusField, title, open }: { p: string; days: Date[]; rows: Row[]; onDay: (r: Row, day: string) => boolean; personField?: string; statusField?: string; title: (r: Row) => string; open: (r: Row) => void }) {
  return (
    <>
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
          {p.split(/\s+/).map((x) => x[0]).slice(0, 2).join('')}
        </span>
        <span className="truncate text-sm font-medium text-slate-700">{p}</span>
      </div>
      {days.map((d, i) => {
        const items = rows.filter((r) => (!personField || String(r[personField] ?? 'Non affecté') === p) && onDay(r, isoDay(d)))
        return (
          <div key={i} className="min-h-[76px] space-y-1.5 border-b border-l border-slate-100 p-1.5">
            {items.map((r) => {
              const s = statusField ? String(r[statusField] ?? '') : ''
              const c = statusColor(s)
              return (
                <button
                  key={String(r.id)}
                  onClick={() => open(r)}
                  className={cn(
                    'block w-full rounded-md border-l-[3px] bg-white px-2 py-1.5 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-primary/40',
                    c === 'rouge' ? 'border-rose-500' : c === 'orange' ? 'border-amber-500' : c === 'vert' ? 'border-emerald-500' : 'border-primary'
                  )}
                >
                  <p className="truncate text-xs font-medium text-slate-800">{title(r)}</p>
                  {s && <p className="truncate text-[11px] text-slate-500">{s}</p>}
                </button>
              )
            })}
          </div>
        )
      })}
    </>
  )
}
