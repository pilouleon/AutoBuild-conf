// Actualités : page d'accueil d'un intranet ou d'un portail (article à la une, fil d'actualités, raccourcis, agenda).
import { useState } from 'react'
import { Icon } from '../../components/icons'
import { Avatar, Badge, Card, CardHeader, PageHeader, cn } from '../../components/ui'
import { formatDate } from '../../lib/format'
import { Link } from '../../lib/router'
import { app, brand } from '../../mockup'
import { type LibraryPageProps, addDays, daysAgo, people } from './data'

interface Article {
  titre: string
  extrait: string
  categorie: string
  date: string
  auteur: string
}

function articles(): Article[] {
  const p = people(6)
  const nom = brand.nomEntreprise
  return [
    { titre: `Bienvenue sur le nouvel espace ${nom}`, extrait: brand.description ?? `Retrouvez ici toutes les informations utiles, vos documents et vos démarches, au même endroit.`, categorie: 'Vie de l’entreprise', date: daysAgo(1), auteur: p[0] },
    { titre: 'Résultats du semestre : une belle dynamique', extrait: 'L’activité progresse sur l’ensemble de nos sites. Merci à toutes les équipes pour leur engagement.', categorie: 'Direction', date: daysAgo(4), auteur: p[1] },
    { titre: 'Nouvelle procédure qualité en vigueur', extrait: 'La procédure mise à jour est disponible dans l’espace Documents. Elle s’applique dès lundi.', categorie: 'Qualité', date: daysAgo(8), auteur: p[2] },
    { titre: `Ils nous ont rejoints ce mois-ci`, extrait: `Bienvenue à ${p[3]} et ${p[4]} qui rejoignent nos équipes.`, categorie: 'Ressources humaines', date: daysAgo(12), auteur: p[5] ?? p[0] }
  ]
}

export function Actualites(_: LibraryPageProps) {
  const liste = articles()
  const [lu, setLu] = useState<string | null>(null)
  const a = liste.find((x) => x.titre === lu)
  const raccourcis = app.navigation.filter((n) => n.cible !== 'actualites').slice(0, 6)
  const evenements = [
    { titre: 'Réunion d’information', date: addDays(new Date(), 3) },
    { titre: 'Formation sécurité', date: addDays(new Date(), 8) },
    { titre: 'Afterwork de l’équipe', date: addDays(new Date(), 15) }
  ]
  if (a)
    return (
      <div className="mx-auto max-w-3xl">
        <button onClick={() => setLu(null)} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-primary">
          <Icon name="chevronLeft" className="h-4 w-4" /> Toutes les actualités
        </button>
        <Badge color="marque">{a.categorie}</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{a.titre}</h1>
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <Avatar name={a.auteur} size="h-6 w-6" /> {a.auteur} · {formatDate(a.date)}
        </p>
        <div className="mt-6 h-56 rounded-2xl bg-gradient-to-br from-primary to-secondary opacity-90" />
        <div className="prose mt-6 space-y-4 text-[15px] leading-relaxed text-slate-700">
          <p>{a.extrait}</p>
          <p>Pour toute question, n’hésitez pas à contacter votre responsable ou le service concerné. Les informations détaillées sont disponibles dans l’espace Documents.</p>
        </div>
      </div>
    )
  return (
    <div>
      <PageHeader title={`Bonjour ${app.utilisateur.nom.split(' ')[0]}`} subtitle={`Les dernières nouvelles de ${brand.nomEntreprise}.`} />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <button onClick={() => setLu(liste[0].titre)} className="block w-full overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-secondary text-left text-primary-fg shadow-sm transition hover:shadow-md">
            <div className="p-8">
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium">À la une</span>
              <h2 className="mt-4 text-2xl font-semibold">{liste[0].titre}</h2>
              <p className="mt-2 max-w-xl text-sm opacity-90">{liste[0].extrait}</p>
            </div>
          </button>
          <div className="grid gap-4 md:grid-cols-3">
            {liste.slice(1).map((x) => (
              <Card key={x.titre} className="cursor-pointer p-5 transition hover:shadow-md">
                <div onClick={() => setLu(x.titre)}>
                  <Badge>{x.categorie}</Badge>
                  <h3 className="mt-3 text-sm font-semibold leading-snug text-slate-900">{x.titre}</h3>
                  <p className="mt-2 line-clamp-3 text-xs text-slate-500">{x.extrait}</p>
                  <p className="mt-3 text-[11px] text-slate-400">{formatDate(x.date)}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Accès rapides" />
            <div className="grid grid-cols-2 gap-2 p-3">
              {raccourcis.map((n) => (
                <Link key={n.id} to={n.id} className="flex flex-col items-center gap-2 rounded-lg p-3 text-center text-xs font-medium text-slate-600 transition hover:bg-primary/5 hover:text-primary">
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Icon name={n.icone} className="h-5 w-5" />
                  </span>
                  {n.label}
                </Link>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Agenda" />
            <ul className="divide-y divide-slate-100">
              {evenements.map((e, i) => (
                <li key={e.titre} className="flex items-center gap-3 px-5 py-3">
                  <span className={cn('flex w-11 flex-col items-center rounded-lg py-1 text-center', i === 0 ? 'bg-primary text-primary-fg' : 'bg-slate-100 text-slate-700')}>
                    <span className="text-[10px] uppercase">{e.date.toLocaleDateString('fr-FR', { month: 'short' })}</span>
                    <span className="text-base font-semibold leading-none">{e.date.getDate()}</span>
                  </span>
                  <span className="text-sm text-slate-700">{e.titre}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
