// Annuaire : collaborateurs (intranet) ou membres du réseau (extranet), filtres par service et fiche contact.
import { useMemo, useState } from 'react'
import { Icon } from '../../components/icons'
import { Avatar, Badge, Card, Input, Modal, PageHeader, Select } from '../../components/ui'
import { app } from '../../mockup'
import { type LibraryPageProps, SERVICES, VILLES, email, people, pick, rng, telephone } from './data'

const POSTES: Record<string, string[]> = {
  Direction: ['Directeur général', 'Directrice administrative'],
  Commercial: ['Responsable commercial', 'Chargée d’affaires', 'Technico-commercial'],
  Exploitation: ['Responsable d’exploitation', 'Chef d’équipe', 'Conducteur de travaux'],
  'Administration et finances': ['Comptable', 'Assistante de gestion'],
  'Ressources humaines': ['Responsable RH', 'Chargée de recrutement'],
  Qualité: ['Responsable qualité', 'Animateur QSE'],
  Informatique: ['Responsable informatique', 'Technicien support'],
  Logistique: ['Responsable logistique', 'Magasinier']
}

export function Annuaire(_: LibraryPageProps) {
  const membres = app.typeProjet !== 'intranet' && app.layout === 'topnav'
  const liste = useMemo(() => {
    return people(14).map((nom) => {
      const r = rng(nom)
      const service = pick(r, SERVICES)
      return { nom, service, poste: membres ? pick(r, ['Gérant', 'Responsable', 'Associé', 'Directrice']) : pick(r, POSTES[service]), site: pick(r, VILLES), tel: telephone(r), email: email(nom), entreprise: membres ? `${pick(r, ['Atelier', 'Groupe', 'Maison', 'Société'])} ${nom.split(' ')[1]}` : '' }
    })
  }, [])
  const [q, setQ] = useState('')
  const [service, setService] = useState('')
  const [fiche, setFiche] = useState<(typeof liste)[number] | null>(null)
  const visibles = liste.filter((p) => (!service || (membres ? p.site : p.service) === service) && (!q || `${p.nom} ${p.poste} ${p.entreprise}`.toLowerCase().includes(q.toLowerCase())))
  const filtres = [...new Set(liste.map((p) => (membres ? p.site : p.service)))].sort()

  return (
    <div>
      <PageHeader title="Annuaire" subtitle={`${liste.length} ${membres ? 'membres' : 'collaborateurs'}`} />
      <div className="mb-5 flex flex-wrap gap-3">
        <Input placeholder={membres ? 'Rechercher un membre, une entreprise…' : 'Rechercher un nom, un poste…'} value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
        <Select value={service} onChange={(e) => setService(e.target.value)} className="w-56">
          <option value="">{membres ? 'Toutes les villes' : 'Tous les services'}</option>
          {filtres.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {visibles.map((p) => (
          <Card key={p.nom} className="cursor-pointer p-5 transition hover:shadow-md">
            <div onClick={() => setFiche(p)} className="flex flex-col items-center text-center">
              <Avatar name={p.nom} size="h-14 w-14 text-base" />
              <p className="mt-3 text-sm font-semibold text-slate-900">{p.nom}</p>
              <p className="text-xs text-slate-500">{membres ? p.entreprise : p.poste}</p>
              <div className="mt-3">
                <Badge color="marque">{membres ? p.site : p.service}</Badge>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Modal open={!!fiche} onClose={() => setFiche(null)} title={fiche?.nom ?? ''}>
        {fiche && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">
              {fiche.poste}
              {membres ? ` · ${fiche.entreprise}` : ` · ${fiche.service}`}
            </p>
            <p className="flex items-center gap-2 text-slate-700">
              <Icon name="mail" className="h-4 w-4 text-slate-400" /> {fiche.email}
            </p>
            <p className="flex items-center gap-2 text-slate-700">
              <Icon name="phone" className="h-4 w-4 text-slate-400" /> {fiche.tel}
            </p>
            <p className="flex items-center gap-2 text-slate-700">
              <Icon name="pin" className="h-4 w-4 text-slate-400" /> {fiche.site}
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
