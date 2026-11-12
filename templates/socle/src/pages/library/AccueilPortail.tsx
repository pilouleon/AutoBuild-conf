// Accueil d'un portail client / extranet : bandeau de bienvenue, chiffres clés, raccourcis et derniers éléments.
import { Icon } from '../../components/icons'
import { Badge, Button, Card, CardHeader, statusColor } from '../../components/ui'
import { formatValue } from '../../lib/format'
import { Link, navigate } from '../../lib/router'
import { useRows } from '../../lib/store'
import { app, brand } from '../../mockup'
import type { Entity } from '../../mockup/types'
import type { LibraryPageProps } from './data'
import { titleOf } from './data'

export function AccueilPortail(_: LibraryPageProps) {
  const entites = app.navigation.filter((n) => n.type === 'entite').map((n) => ({ nav: n, e: app.entites.find((e) => e.id === n.cible) })).filter((x): x is { nav: (typeof app.navigation)[number]; e: Entity } => !!x.e)
  const raccourcis = app.navigation.filter((n) => n.id !== app.navigation[0]?.id).slice(0, 4)
  return (
    <div>
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-secondary text-primary-fg shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-6 p-8">
          <div>
            <p className="text-sm opacity-80">{brand.nomEntreprise}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Bonjour {app.utilisateur.nom.split(' ')[0]}</h1>
            <p className="mt-2 max-w-xl text-sm opacity-90">{app.sousTitre ?? 'Retrouvez ici le suivi de vos dossiers, vos documents et vos échanges avec nos équipes.'}</p>
          </div>
          {raccourcis[0] && (
            <Button variant="secondary" icon="plus" onClick={() => navigate(raccourcis[0].id)}>
              {raccourcis[0].label}
            </Button>
          )}
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {raccourcis.map((n) => (
          <Link key={n.id} to={n.id} className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md">
            <span className="inline-flex rounded-lg bg-primary/10 p-2 text-primary">
              <Icon name={n.icone} className="h-5 w-5" />
            </span>
            <p className="mt-3 flex items-center justify-between text-sm font-semibold text-slate-900">
              {n.label}
              <Icon name="chevronRight" className="h-4 w-4 text-slate-300 transition group-hover:text-primary" />
            </p>
          </Link>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {entites.slice(0, 2).map(({ nav, e }) => (
          <Derniers key={e.id} entity={e} navId={nav.id} />
        ))}
      </div>
    </div>
  )
}

function Derniers({ entity, navId }: { entity: Entity; navId: string }) {
  const rows = useRows(entity.id)
  const montant = entity.champs.find((f) => f.type === 'euro')
  return (
    <Card>
      <CardHeader
        title={`${entity.labelPluriel} récent${entity.feminin ? 'e' : ''}s`}
        action={
          <Link to={navId} className="text-xs font-medium text-primary hover:underline">
            Tout voir
          </Link>
        }
      />
      <ul className="divide-y divide-slate-100">
        {rows.slice(0, 5).map((r) => (
          <li key={String(r.id)}>
            <Link to={`${navId}/${r.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-slate-50">
              <span className="flex-1 truncate font-medium text-slate-800">{titleOf(entity, r)}</span>
              {montant && <span className="tabular-nums text-slate-500">{formatValue(r[montant.id], 'euro')}</span>}
              {entity.champStatut && r[entity.champStatut] && <Badge color={statusColor(String(r[entity.champStatut]))}>{String(r[entity.champStatut])}</Badge>}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
