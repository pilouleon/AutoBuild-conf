// Éditeur de devis : client, lignes (quantité, prix unitaire, remise), totaux HT / TVA / TTC et aperçu du document.
import { useState } from 'react'
import { BrandMark } from '../../components/Layout'
import { Icon } from '../../components/icons'
import { Badge, Button, Card, CardHeader, Input, Label, PageHeader, Select, Tabs } from '../../components/ui'
import { formatDate, formatValue } from '../../lib/format'
import { useRows } from '../../lib/store'
import { brand } from '../../mockup'
import { type LibraryPageProps, byName, daysAgo, fieldOf, hasType, pickEntity, titleOf, VILLES } from './data'

interface Ligne {
  id: number
  designation: string
  quantite: number
  unite: string
  pu: number
  remise: number
}

const TVA = 0.2

export function Devis({ source }: LibraryPageProps) {
  // Lignes proposées : le catalogue (articles, produits, prestations) s'il existe.
  const catalogue = pickEntity(source, (e) => byName(e, /article|produit|prestation|catalogue|service|tarif/) && hasType(e, 'euro'))
  const isCatalogue = !!catalogue && byName(catalogue, /article|produit|prestation|catalogue|service|tarif/)
  const items = useRows(isCatalogue ? catalogue!.id : '')
  const prix = fieldOf(catalogue, (f) => f.type === 'euro')?.id
  const clientsEntity = pickEntity(undefined, (e) => byName(e, /client|compte|société|adhérent|donneur/))
  const clients = useRows(clientsEntity && byName(clientsEntity, /client|compte|société|adhérent|donneur/) ? clientsEntity.id : '')
  const clientNames = clients.length ? clients.map((c) => titleOf(clientsEntity!, c)) : ['Groupe Arnaud', 'Atelier Delmas', 'SAS Vercors Industrie', 'Mairie de Saint-Priest']

  const initial: Ligne[] = items.length
    ? items.slice(0, 4).map((r, i) => ({ id: i, designation: titleOf(catalogue!, r), quantite: [2, 1, 5, 3][i] ?? 1, unite: 'u', pu: Number(prix ? r[prix] : 0) || 120, remise: i === 2 ? 5 : 0 }))
    : [
        { id: 0, designation: 'Étude et cadrage', quantite: 2, unite: 'jour', pu: 850, remise: 0 },
        { id: 1, designation: 'Fourniture et installation', quantite: 1, unite: 'forfait', pu: 4200, remise: 0 },
        { id: 2, designation: 'Main-d’œuvre', quantite: 12, unite: 'h', pu: 62, remise: 5 },
        { id: 3, designation: 'Déplacement', quantite: 1, unite: 'forfait', pu: 180, remise: 0 }
      ]
  const [lignes, setLignes] = useState<Ligne[]>(initial)
  const [client, setClient] = useState(clientNames[0])
  const [objet, setObjet] = useState('Proposition suite à notre échange')
  const [validite, setValidite] = useState('30')
  const [vue, setVue] = useState<'edition' | 'apercu'>('edition')
  const [statut, setStatut] = useState<'Brouillon' | 'Envoyé'>('Brouillon')
  const numero = `D-${new Date().getFullYear()}-0${142 + lignes.length}`

  const ht = lignes.reduce((s, l) => s + l.quantite * l.pu * (1 - l.remise / 100), 0)
  const tva = ht * TVA
  const set = (id: number, patch: Partial<Ligne>) => setLignes(lignes.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  const ajouter = () => {
    const next = items[lignes.length % Math.max(1, items.length)]
    setLignes([...lignes, { id: Date.now(), designation: next && catalogue ? titleOf(catalogue, next) : 'Nouvelle ligne', quantite: 1, unite: 'u', pu: next && prix ? Number(next[prix]) || 100 : 100, remise: 0 }])
  }

  return (
    <div>
      <PageHeader
        title={`Devis ${numero}`}
        subtitle={`${client} · créé le ${formatDate(daysAgo(0))}`}
        actions={
          <>
            <Tabs value={vue} onChange={setVue} options={[{ value: 'edition', label: 'Édition', icon: 'file' }, { value: 'apercu', label: 'Aperçu', icon: 'search' }]} />
            <Button variant="outline" icon="download">
              PDF
            </Button>
            <Button icon="mail" onClick={() => setStatut('Envoyé')} disabled={statut === 'Envoyé'}>
              {statut === 'Envoyé' ? 'Envoyé' : 'Envoyer au client'}
            </Button>
          </>
        }
      />
      {vue === 'edition' ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
          <Card>
            <CardHeader title="Lignes du devis" subtitle={isCatalogue ? `À partir du catalogue ${catalogue!.labelPluriel.toLowerCase()}` : undefined} action={<Badge color={statut === 'Envoyé' ? 'bleu' : 'orange'}>{statut}</Badge>} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                    <th className="px-5 py-2.5 font-medium">Désignation</th>
                    <th className="w-20 px-2 py-2.5 font-medium">Qté</th>
                    <th className="w-24 px-2 py-2.5 font-medium">Unité</th>
                    <th className="w-28 px-2 py-2.5 font-medium">P.U. HT</th>
                    <th className="w-20 px-2 py-2.5 font-medium">Remise</th>
                    <th className="w-28 px-5 py-2.5 text-right font-medium">Total HT</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l) => (
                    <tr key={l.id} className="border-b border-slate-50">
                      <td className="px-5 py-2">
                        <Input value={l.designation} onChange={(e) => set(l.id, { designation: e.target.value })} />
                      </td>
                      <td className="px-2 py-2">
                        <Input type="number" value={l.quantite} onChange={(e) => set(l.id, { quantite: Number(e.target.value) })} />
                      </td>
                      <td className="px-2 py-2">
                        <Input value={l.unite} onChange={(e) => set(l.id, { unite: e.target.value })} />
                      </td>
                      <td className="px-2 py-2">
                        <Input type="number" value={l.pu} onChange={(e) => set(l.id, { pu: Number(e.target.value) })} />
                      </td>
                      <td className="px-2 py-2">
                        <Input type="number" value={l.remise} onChange={(e) => set(l.id, { remise: Number(e.target.value) })} />
                      </td>
                      <td className="px-5 py-2 text-right font-medium text-slate-900">{formatValue(l.quantite * l.pu * (1 - l.remise / 100), 'euro')}</td>
                      <td className="pr-3">
                        <button onClick={() => setLignes(lignes.filter((x) => x.id !== l.id))} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600" title="Supprimer la ligne">
                          <Icon name="x" className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3">
              <Button variant="ghost" icon="plus" onClick={ajouter}>
                Ajouter une ligne
              </Button>
            </div>
          </Card>
          <div className="space-y-6">
            <Card className="space-y-4 p-5">
              <div>
                <Label>Client</Label>
                <Select value={client} onChange={(e) => setClient(e.target.value)}>
                  {clientNames.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Objet</Label>
                <Input value={objet} onChange={(e) => setObjet(e.target.value)} />
              </div>
              <div>
                <Label>Validité (jours)</Label>
                <Input type="number" value={validite} onChange={(e) => setValidite(e.target.value)} />
              </div>
            </Card>
            <Totaux ht={ht} tva={tva} />
          </div>
        </div>
      ) : (
        <Card className="mx-auto max-w-3xl p-10">
          <div className="flex items-start justify-between">
            <div>
              <BrandMark size="h-10" />
              <p className="mt-3 text-sm font-semibold text-slate-900">{brand.nomEntreprise}</p>
              <p className="text-xs text-slate-500">{pickVille(brand.nomEntreprise)}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold text-primary">DEVIS</p>
              <p className="text-sm text-slate-600">{numero}</p>
              <p className="text-xs text-slate-500">Valable {validite} jours</p>
            </div>
          </div>
          <div className="mt-8 rounded-lg bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">Destinataire</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{client}</p>
          </div>
          <p className="mt-6 text-sm text-slate-700">
            <span className="font-medium">Objet :</span> {objet}
          </p>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b-2 border-primary text-left text-xs text-slate-500">
                <th className="py-2 font-medium">Désignation</th>
                <th className="py-2 text-right font-medium">Qté</th>
                <th className="py-2 text-right font-medium">P.U. HT</th>
                <th className="py-2 text-right font-medium">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map((l) => (
                <tr key={l.id} className="border-b border-slate-100">
                  <td className="py-2 text-slate-800">
                    {l.designation}
                    {l.remise > 0 && <span className="ml-2 text-xs text-slate-500">(remise {l.remise} %)</span>}
                  </td>
                  <td className="py-2 text-right text-slate-600">
                    {l.quantite} {l.unite}
                  </td>
                  <td className="py-2 text-right text-slate-600">{formatValue(l.pu, 'euro')}</td>
                  <td className="py-2 text-right font-medium text-slate-900">{formatValue(l.quantite * l.pu * (1 - l.remise / 100), 'euro')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ml-auto mt-6 w-64">
            <Totaux ht={ht} tva={tva} flat />
          </div>
          <p className="mt-10 text-xs text-slate-400">Bon pour accord — date et signature du client :</p>
        </Card>
      )}
    </div>
  )
}

function pickVille(seed: string): string {
  return VILLES[seed.length % VILLES.length]
}

function Totaux({ ht, tva, flat }: { ht: number; tva: number; flat?: boolean }) {
  const content = (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between text-slate-600">
        <span>Total HT</span>
        <span>{formatValue(Math.round(ht), 'euro')}</span>
      </div>
      <div className="flex justify-between text-slate-600">
        <span>TVA 20 %</span>
        <span>{formatValue(Math.round(tva), 'euro')}</span>
      </div>
      <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
        <span>Total TTC</span>
        <span className="text-primary">{formatValue(Math.round(ht + tva), 'euro')}</span>
      </div>
    </div>
  )
  return flat ? content : <Card className="p-5">{content}</Card>
}
