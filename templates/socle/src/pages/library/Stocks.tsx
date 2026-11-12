// Stocks par dépôt : quantités, seuils d'alerte, réassort et transferts entre dépôts.
import { useMemo, useState } from 'react'
import { Icon } from '../../components/icons'
import { Badge, Button, Card, CardHeader, Input, Label, Modal, PageHeader, Select, cn } from '../../components/ui'
import { formatValue } from '../../lib/format'
import { useRows } from '../../lib/store'
import { brand } from '../../mockup'
import { type LibraryPageProps, VILLES, byName, fieldOf, pick, pickEntity, rng, titleOf } from './data'

interface Ligne {
  ref: string
  article: string
  depots: number[]
  seuil: number
  pu: number
}

export function Stocks({ source }: LibraryPageProps) {
  const entity = pickEntity(source, (e) => byName(e, /article|produit|pièce|piece|matériel|materiel|référence|stock/))
  const rows = useRows(entity?.id ?? '')
  const prix = fieldOf(entity, (f) => f.type === 'euro')?.id
  const r0 = rng(brand.nomEntreprise + 'depots')
  const depots = useMemo(() => ['Dépôt principal', `Dépôt ${pick(r0, VILLES)}`, `Dépôt ${pick(r0, VILLES.slice(5))}`], [])
  const lignes: Ligne[] = useMemo(() => {
    const base = rows.length ? rows.slice(0, 12).map((r) => (entity ? titleOf(entity, r) : '')) : ['Article standard A', 'Article standard B', 'Kit de fixation', 'Consommable 25 kg', 'Pièce de rechange', 'Emballage carton']
    return base.map((article, i) => {
      const r = rng(article)
      const seuil = 10 + Math.floor(r() * 30)
      const depotsQ = depots.map((_, d) => Math.max(0, Math.floor(r() * (d === 0 ? 160 : 70)) - (i % 4 === 1 && d === 0 ? 150 : 0)))
      return { ref: `REF-${String(1040 + i * 7)}`, article, depots: depotsQ, seuil, pu: Number(prix ? rows[i]?.[prix] : 0) || Math.round(8 + r() * 140) }
    })
  }, [rows, depots])
  const [filtre, setFiltre] = useState<'tous' | 'alerte'>('tous')
  const [q, setQ] = useState('')
  const [transfert, setTransfert] = useState<Ligne | null>(null)
  const total = (l: Ligne) => l.depots.reduce((a, b) => a + b, 0)
  const alertes = lignes.filter((l) => total(l) < l.seuil * 1.5 || l.depots[0] < l.seuil)
  const visibles = (filtre === 'alerte' ? alertes : lignes).filter((l) => !q || `${l.article} ${l.ref}`.toLowerCase().includes(q.toLowerCase()))
  const valeur = lignes.reduce((s, l) => s + total(l) * l.pu, 0)

  return (
    <div>
      <PageHeader title="Stocks" subtitle={`${lignes.length} références réparties sur ${depots.length} dépôts`} actions={<Button icon="download" variant="outline">Exporter l’inventaire</Button>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-slate-500">Valeur du stock</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatValue(valeur, 'euro')}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Références sous le seuil</p>
          <p className="mt-2 text-2xl font-semibold text-rose-600">{alertes.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-slate-500">Dépôts</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{depots.length}</p>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader
          title="État des stocks"
          action={
            <div className="flex items-center gap-2">
              <Input placeholder="Rechercher une référence…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
              <Select value={filtre} onChange={(e) => setFiltre(e.target.value as 'tous' | 'alerte')} className="w-44">
                <option value="tous">Toutes les références</option>
                <option value="alerte">À réapprovisionner</option>
              </Select>
            </div>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                <th className="px-5 py-2.5 font-medium">Référence</th>
                <th className="px-3 py-2.5 font-medium">{entity && byName(entity, /article|produit|pièce|piece|matériel|materiel|référence|stock/) ? entity.label : 'Article'}</th>
                {depots.map((d) => (
                  <th key={d} className="px-3 py-2.5 text-right font-medium">
                    {d}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right font-medium">Total</th>
                <th className="px-3 py-2.5 font-medium">État</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {visibles.map((l) => {
                const t = total(l)
                const etat = t === 0 ? 'Rupture' : t < l.seuil * 1.5 || l.depots[0] < l.seuil ? 'Sous le seuil' : 'Disponible'
                return (
                  <tr key={l.ref} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{l.ref}</td>
                    <td className="px-3 py-3 font-medium text-slate-900">{l.article}</td>
                    {l.depots.map((q, i) => (
                      <td key={i} className={cn('px-3 py-3 text-right tabular-nums', q < l.seuil ? 'text-rose-600' : 'text-slate-700')}>
                        {q}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">{t}</td>
                    <td className="px-3 py-3">
                      <Badge color={etat === 'Disponible' ? 'vert' : etat === 'Rupture' ? 'rouge' : 'orange'}>{etat}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setTransfert(l)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10">
                        <Icon name="truck" className="h-3.5 w-3.5" /> Transférer
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Modal
        open={!!transfert}
        onClose={() => setTransfert(null)}
        title={`Transfert — ${transfert?.article ?? ''}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setTransfert(null)}>
              Annuler
            </Button>
            <Button onClick={() => setTransfert(null)}>Valider le transfert</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Depuis</Label>
            <Select defaultValue={depots[0]}>
              {depots.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Vers</Label>
            <Select defaultValue={depots[1]}>
              {depots.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Quantité</Label>
            <Input type="number" defaultValue={10} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
