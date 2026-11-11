// Page générique d'une entité métier : liste, kanban, calendrier, fiche détail, création.
import { useMemo, useState } from 'react'
import { Icon } from '../components/icons'
import { Avatar, Badge, Button, Card, EmptyState, Input, Label, Modal, PageHeader, Select, Tabs, cn, statusColor } from '../components/ui'
import { formatDate, formatValue } from '../lib/format'
import { Link, navigate } from '../lib/router'
import { addRow, updateRow, useRows } from '../lib/store'
import type { Entity, Field, Vue } from '../mockup/types'
import { getEntity } from '../mockup'

type Row = Record<string, string | number | boolean | null>

export function EntityPage({ entity, navId, itemId }: { entity: Entity; navId: string; itemId?: string }) {
  const rows = useRows(entity.id)
  if (itemId) {
    const row = rows.find((r) => String(r.id) === itemId)
    if (row) return <EntityDetail entity={entity} navId={navId} row={row} />
  }
  return <EntityCollection entity={entity} navId={navId} rows={rows} />
}

function listFields(entity: Entity): Field[] {
  const explicit = entity.champs.filter((c) => c.dansListe)
  return (explicit.length ? explicit : entity.champs).filter((c) => c.type !== 'texte-long').slice(0, 6)
}

function CellValue({ field, value }: { field: Field; value: Row[string] }) {
  if (value === null || value === undefined || value === '') return <span className="text-slate-300">—</span>
  if (field.type === 'statut' || field.type === 'choix') return <Badge color={field.type === 'statut' ? statusColor(String(value), field.couleurs) : 'gris'}>{String(value)}</Badge>
  if (field.type === 'personne')
    return (
      <span className="inline-flex items-center gap-2">
        <Avatar name={String(value)} size="h-6 w-6" />
        {String(value)}
      </span>
    )
  if (field.type === 'reference') {
    const target = getEntity(field.reference)
    return (
      <span className="inline-flex items-center gap-1.5 text-slate-700">
        {target && <Icon name={target.icone} className="h-3.5 w-3.5 text-slate-400" />}
        {String(value)}
      </span>
    )
  }
  if (field.type === 'pourcent' && typeof value === 'number')
    return (
      <span className="inline-flex items-center gap-2">
        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
          <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(100, value)}%` }} />
        </span>
        <span className="text-xs text-slate-600">{value} %</span>
      </span>
    )
  return <>{formatValue(value, field.type)}</>
}

function EntityCollection({ entity, navId, rows }: { entity: Entity; navId: string; rows: Row[] }) {
  const vues = entity.vues.length ? entity.vues : (['liste'] as Vue[])
  const [vue, setVue] = useState<Vue>(vues[0])
  const [q, setQ] = useState('')
  const [statut, setStatut] = useState('')
  const [creating, setCreating] = useState(false)
  const statusField = entity.champs.find((c) => c.id === entity.champStatut)
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!q || Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(q.toLowerCase()))) &&
          (!statut || !statusField || r[statusField.id] === statut)
      ),
    [rows, q, statut, statusField]
  )
  const nouveau = entity.feminin ? 'Nouvelle' : 'Nouveau'
  return (
    <div>
      <PageHeader
        title={entity.labelPluriel}
        subtitle={`${rows.length} ${rows.length > 1 ? entity.labelPluriel.toLowerCase() : entity.label.toLowerCase()}`}
        actions={
          <>
            <Button variant="outline" icon="download">Exporter</Button>
            <Button icon="plus" onClick={() => setCreating(true)}>
              {nouveau} {entity.label.toLowerCase()}
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative w-full max-w-xs">
            <Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Rechercher dans ${entity.labelPluriel.toLowerCase()}…`} className="pl-9" />
          </div>
          {statusField?.options && (
            <Select value={statut} onChange={(e) => setStatut(e.target.value)} className="w-48">
              <option value="">Tous les statuts</option>
              {statusField.options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </Select>
          )}
        </div>
        {vues.length > 1 && (
          <Tabs
            value={vue}
            onChange={setVue}
            options={vues.map((v) => ({ value: v, label: v === 'liste' ? 'Liste' : v === 'kanban' ? 'Kanban' : 'Calendrier', icon: v === 'liste' ? 'list' : v === 'kanban' ? 'kanban' : 'calendar' }))}
          />
        )}
      </div>
      {filtered.length === 0 ? (
        <Card>
          <EmptyState icon={entity.icone} title="Aucun résultat" text="Modifiez la recherche ou les filtres." />
        </Card>
      ) : vue === 'kanban' && statusField ? (
        <Kanban entity={entity} navId={navId} rows={filtered} statusField={statusField} />
      ) : vue === 'calendrier' && entity.champDate ? (
        <CalendarView entity={entity} navId={navId} rows={filtered} />
      ) : (
        <Table entity={entity} navId={navId} rows={filtered} />
      )}
      <CreateModal entity={entity} open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

function Table({ entity, navId, rows }: { entity: Entity; navId: string; rows: Row[] }) {
  const fields = listFields(entity)
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            {fields.map((f) => (
              <th key={f.id} className={cn('px-5 py-3', (f.type === 'euro' || f.type === 'nombre') && 'text-right')}>
                {f.label}
              </th>
            ))}
            <th className="w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={String(r.id)} onClick={() => navigate(`${navId}/${r.id}`)} className="cursor-pointer transition hover:bg-slate-50">
              {fields.map((f) => (
                <td key={f.id} className={cn('px-5 py-3 text-slate-700', f.id === entity.champTitre && 'font-medium text-slate-900', (f.type === 'euro' || f.type === 'nombre') && 'text-right tabular-nums', (f.type === 'date' || f.type === 'euro' || f.type === 'telephone') && 'whitespace-nowrap')}>
                  <CellValue field={f} value={r[f.id]} />
                </td>
              ))}
              <td className="pr-4 text-slate-300">
                <Icon name="chevronRight" className="h-4 w-4" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function Kanban({ entity, navId, rows, statusField }: { entity: Entity; navId: string; rows: Row[]; statusField: Field }) {
  const columns = statusField.options?.length ? statusField.options : [...new Set(rows.map((r) => String(r[statusField.id] ?? '')))]
  const secondary = listFields(entity).filter((f) => f.id !== entity.champTitre && f.id !== statusField.id).slice(0, 3)
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => {
        const items = rows.filter((r) => String(r[statusField.id]) === col)
        return (
          <div
            key={col}
            className="w-72 shrink-0 rounded-xl bg-slate-100/70 p-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => updateRow(entity.id, e.dataTransfer.getData('text/plain'), { [statusField.id]: col })}
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <Badge color={statusColor(col, statusField.couleurs)}>{col}</Badge>
              <span className="text-xs font-medium text-slate-500">{items.length}</span>
            </div>
            <div className="space-y-2.5">
              {items.map((r) => (
                <div
                  key={String(r.id)}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', String(r.id))}
                  onClick={() => navigate(`${navId}/${r.id}`)}
                  className="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-primary/40 hover:shadow"
                >
                  <p className="text-sm font-medium text-slate-900">{String(r[entity.champTitre] ?? '')}</p>
                  <div className="mt-2 space-y-1 text-xs text-slate-500">
                    {secondary.map((f) => (
                      <div key={f.id} className="flex items-center justify-between gap-2">
                        <span>{f.label}</span>
                        <span className="truncate text-slate-700">{formatValue(r[f.id], f.type)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CalendarView({ entity, navId, rows }: { entity: Entity; navId: string; rows: Row[] }) {
  const dateField = entity.champDate!
  const dates = rows.map((r) => new Date(String(r[dateField]))).filter((d) => !Number.isNaN(d.getTime()))
  const ref = dates.length ? dates.sort((a, b) => a.getTime() - b.getTime())[Math.floor(dates.length / 2)] : new Date()
  const [month, setMonth] = useState(new Date(ref.getFullYear(), ref.getMonth(), 1))
  const start = new Date(month)
  start.setDate(1 - ((month.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const statusField = entity.champs.find((c) => c.id === entity.champStatut)
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <p className="text-sm font-semibold capitalize text-slate-900">{month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</p>
        <div className="flex gap-1">
          <Button variant="ghost" icon="chevronLeft" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
          <Button variant="ghost" icon="chevronRight" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
        </div>
      </div>
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50 text-center text-xs font-medium text-slate-500">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const items = rows.filter((r) => String(r[dateField]).slice(0, 10) === key(d))
          return (
            <div key={key(d)} className={cn('min-h-24 border-b border-r border-slate-100 p-1.5', d.getMonth() !== month.getMonth() && 'bg-slate-50/60')}>
              <p className={cn('mb-1 text-right text-xs', d.getMonth() !== month.getMonth() ? 'text-slate-300' : 'text-slate-500')}>{d.getDate()}</p>
              {items.slice(0, 3).map((r) => (
                <Link
                  key={String(r.id)}
                  to={`${navId}/${r.id}`}
                  className={cn('mb-1 block truncate rounded px-1.5 py-0.5 text-[11px] font-medium', statusField ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-700')}
                >
                  {String(r[entity.champTitre] ?? '')}
                </Link>
              ))}
              {items.length > 3 && <p className="px-1 text-[11px] text-slate-400">+{items.length - 3}</p>}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function EntityDetail({ entity, navId, row }: { entity: Entity; navId: string; row: Row }) {
  const statusField = entity.champs.find((c) => c.id === entity.champStatut)
  const others = entity.champs.filter((c) => c.id !== entity.champTitre)
  return (
    <div>
      <Link to={navId} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary">
        <Icon name="chevronLeft" className="h-4 w-4" /> {entity.labelPluriel}
      </Link>
      <PageHeader
        title={String(row[entity.champTitre] ?? entity.label)}
        subtitle={entity.label}
        actions={
          <>
            {statusField && row[statusField.id] && <Badge color={statusColor(String(row[statusField.id]), statusField.couleurs)}>{String(row[statusField.id])}</Badge>}
            <Button variant="outline" icon="file">Exporter en PDF</Button>
            <Button icon="check">Valider</Button>
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="grid gap-x-8 gap-y-5 p-6 sm:grid-cols-2">
            {others.map((f) => (
              <div key={f.id} className={f.type === 'texte-long' ? 'sm:col-span-2' : ''}>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{f.label}</p>
                <div className="mt-1 text-sm text-slate-800">
                  <CellValue field={f} value={row[f.id]} />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-slate-900">Historique</h3>
          </div>
          <ol className="space-y-4 p-5 text-sm">
            {[
              { t: 'Modifié', who: 'Julie Bernard', when: 'il y a 2 h' },
              { t: 'Document ajouté', who: 'Thomas Petit', when: 'hier' },
              { t: 'Créé', who: 'Camille Martin', when: formatDate(String(row[entity.champDate ?? ''] ?? '2026-10-02')) }
            ].map((h, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div>
                  <p className="font-medium text-slate-800">{h.t}</p>
                  <p className="text-xs text-slate-500">
                    {h.who} · {h.when}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  )
}

function CreateModal({ entity, open, onClose }: { entity: Entity; open: boolean; onClose: () => void }) {
  const [values, setValues] = useState<Row>({})
  const set = (id: string, v: string | number) => setValues((s) => ({ ...s, [id]: v }))
  const submit = () => {
    addRow(entity.id, values)
    setValues({})
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${entity.feminin ? 'Nouvelle' : 'Nouveau'} ${entity.label.toLowerCase()}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit}>Enregistrer</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {entity.champs.map((f) => (
          <div key={f.id} className={f.type === 'texte-long' ? 'sm:col-span-2' : ''}>
            <Label>{f.label}</Label>
            {f.options ? (
              <Select value={String(values[f.id] ?? '')} onChange={(e) => set(f.id, e.target.value)}>
                <option value="">Choisir…</option>
                {f.options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Select>
            ) : f.type === 'texte-long' ? (
              <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" rows={3} onChange={(e) => set(f.id, e.target.value)} />
            ) : (
              <Input
                type={f.type === 'date' ? 'date' : f.type === 'euro' || f.type === 'nombre' || f.type === 'pourcent' ? 'number' : f.type === 'email' ? 'email' : 'text'}
                onChange={(e) => set(f.id, f.type === 'euro' || f.type === 'nombre' || f.type === 'pourcent' ? Number(e.target.value) : e.target.value)}
              />
            )}
          </div>
        ))}
      </div>
    </Modal>
  )
}
