// Documents : arborescence de dossiers (un par élément de l'entité source, ou par thème), fichiers avec version,
// auteur, date ; aperçu et dépôt simulé.
import { useMemo, useState } from 'react'
import { Icon } from '../../components/icons'
import { Avatar, Badge, Button, Card, Input, PageHeader, cn } from '../../components/ui'
import { formatDate } from '../../lib/format'
import { useRows } from '../../lib/store'
import { app } from '../../mockup'
import { type LibraryPageProps, byName, daysAgo, people, pick, pickEntity, rng, titleOf } from './data'

interface Doc {
  id: string
  nom: string
  ext: 'pdf' | 'docx' | 'xlsx' | 'jpg'
  taille: string
  auteur: string
  date: string
  version: number
}

const MODELES: Record<string, string[]> = {
  chantier: ['PV de réception', 'Plan d’exécution', 'Photos de fin de travaux', 'Compte rendu de réunion', 'Bon de livraison', 'PPSPS'],
  client: ['Contrat signé', 'Conditions générales', 'Attestation d’assurance', 'Bon de commande', 'Facture'],
  intranet: ['Note de service', 'Procédure qualité', 'Livret d’accueil', 'Modèle de compte rendu', 'Charte informatique', 'Organigramme'],
  defaut: ['Compte rendu', 'Rapport mensuel', 'Contrat', 'Fiche technique', 'Photos', 'Tableau de suivi']
}

export function Documents({ source }: LibraryPageProps) {
  const portail = app.layout === 'topnav'
  const entity = pickEntity(source, (e) => byName(e, /chantier|dossier|projet|affaire|client|contrat|intervention|commande/))
  const rows = useRows(entity?.id ?? '')
  const modele = entity && byName(entity, /chantier|travaux|intervention/) ? 'chantier' : entity && byName(entity, /client|contrat|commande/) ? 'client' : app.typeProjet === 'intranet' ? 'intranet' : 'defaut'
  const dossiers = useMemo(() => {
    const base = app.typeProjet === 'intranet' || !rows.length ? ['Ressources humaines', 'Qualité et procédures', 'Communication', 'Modèles', 'Direction'] : rows.slice(0, 8).map((r) => titleOf(entity!, r))
    return base
  }, [rows])
  const [dossier, setDossier] = useState(dossiers[0])
  const [q, setQ] = useState('')
  const [ajouts, setAjouts] = useState<Record<string, Doc[]>>({})
  const auteurs = people(6)
  const docs = (d: string): Doc[] => {
    const r = rng(d)
    const n = 3 + Math.floor(r() * 4)
    const gen = MODELES[modele].slice(0, n).map((m, i): Doc => {
      const ext = /photo/i.test(m) ? 'jpg' : /tableau|suivi/i.test(m) ? 'xlsx' : /modèle|note|procédure|compte rendu/i.test(m) && i % 2 ? 'docx' : 'pdf'
      return { id: `${d}-${i}`, nom: `${m}${app.typeProjet === 'intranet' ? '' : ` — ${d}`}`, ext, taille: `${(0.2 + r() * 4.5).toFixed(1).replace('.', ',')} Mo`, auteur: pick(r, auteurs), date: daysAgo(Math.floor(r() * 40)), version: 1 + Math.floor(r() * 3) }
    })
    return [...(ajouts[d] ?? []), ...gen]
  }
  const liste = docs(dossier).filter((d) => !q || d.nom.toLowerCase().includes(q.toLowerCase()))
  const deposer = () => setAjouts({ ...ajouts, [dossier]: [{ id: String(Date.now()), nom: `Nouveau document — ${dossier}`, ext: 'pdf', taille: '1,2 Mo', auteur: app.utilisateur.nom, date: daysAgo(0), version: 1 }, ...(ajouts[dossier] ?? [])] })

  return (
    <div>
      <PageHeader title={portail ? 'Mes documents' : 'Documents'} subtitle={entity && app.typeProjet !== 'intranet' && rows.length ? `Classés par ${entity.label.toLowerCase()}` : 'Classés par thème'} actions={<Button icon="plus" onClick={deposer}>Déposer un document</Button>} />
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card className="p-2">
          {dossiers.map((d) => (
            <button key={d} onClick={() => setDossier(d)} className={cn('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition', d === dossier ? 'bg-primary/10 font-medium text-primary' : 'text-slate-600 hover:bg-slate-50')}>
              <Icon name="folder" className="h-4 w-4 shrink-0" />
              <span className="truncate">{d}</span>
              <span className="ml-auto text-xs text-slate-400">{docs(d).length}</span>
            </button>
          ))}
        </Card>
        <Card>
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Icon name="folder" className="h-4 w-4 text-primary" /> {dossier}
            </p>
            <Input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56" />
          </div>
          <ul className="divide-y divide-slate-100">
            {liste.map((d) => (
              <li key={d.id} className="group flex items-center gap-4 px-5 py-3 hover:bg-slate-50/60">
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold uppercase', d.ext === 'pdf' ? 'bg-rose-50 text-rose-600' : d.ext === 'xlsx' ? 'bg-emerald-50 text-emerald-600' : d.ext === 'jpg' ? 'bg-violet-50 text-violet-600' : 'bg-sky-50 text-sky-600')}>{d.ext}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{d.nom}</p>
                  <p className="text-xs text-slate-500">
                    {d.taille} · modifié le {formatDate(d.date)}
                  </p>
                </div>
                {d.version > 1 && <Badge>v{d.version}</Badge>}
                <span className="hidden items-center gap-2 text-xs text-slate-500 md:flex">
                  <Avatar name={d.auteur} size="h-6 w-6" /> {d.auteur}
                </span>
                <button className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary" title="Télécharger">
                  <Icon name="download" className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
