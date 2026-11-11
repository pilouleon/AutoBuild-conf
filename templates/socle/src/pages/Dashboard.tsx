import { BarChart, DonutChart, LineChart } from '../components/charts'
import { Icon } from '../components/icons'
import { Badge, Card, CardHeader, PageHeader, statusColor } from '../components/ui'
import { formatValue } from '../lib/format'
import { Link } from '../lib/router'
import { useRows } from '../lib/store'
import { app, brand, getEntity } from '../mockup'

export function Dashboard() {
  const tb = app.tableauDeBord
  return (
    <div>
      <PageHeader title={tb.titre} subtitle={tb.intro ?? `Bonjour ${app.utilisateur.nom.split(' ')[0]}, voici l'activité de ${brand.nomEntreprise}.`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tb.kpis.map((k) => (
          <Card key={k.label} className="p-5">
            <p className="text-sm text-slate-500">{k.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{formatValue(k.valeur, k.format)}</p>
            {k.evolution !== undefined && (
              <p className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${k.evolution >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                <Icon name={k.evolution >= 0 ? 'arrowUp' : 'arrowDown'} className="h-3 w-3" />
                {Math.abs(k.evolution)} % vs mois dernier
              </p>
            )}
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {tb.graphiques.map((g) => (
          <Card key={g.titre}>
            <CardHeader title={g.titre} />
            <div className="p-5">
              {g.type === 'barres' && <BarChart data={g.donnees} format={g.format} />}
              {g.type === 'courbe' && <LineChart data={g.donnees} format={g.format} />}
              {g.type === 'donut' && <DonutChart data={g.donnees} format={g.format} />}
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {tb.listes.map((l) => (
          <RecentList key={l.titre} titre={l.titre} entityId={l.entite} limite={l.limite} />
        ))}
      </div>
    </div>
  )
}

function RecentList({ titre, entityId, limite }: { titre: string; entityId: string; limite: number }) {
  const entity = getEntity(entityId)
  const rows = useRows(entityId)
  const nav = app.navigation.find((n) => n.type === 'entite' && n.cible === entityId)
  if (!entity) return null
  const secondary = entity.champs.filter((c) => c.id !== entity.champTitre && c.type !== 'statut').slice(0, 2)
  return (
    <Card>
      <CardHeader title={titre} action={nav && <Link to={nav.id} className="text-xs font-medium text-primary hover:underline">Tout voir</Link>} />
      <ul className="divide-y divide-slate-100">
        {rows.slice(0, limite).map((r) => (
          <li key={String(r.id)} className="flex items-center justify-between gap-4 px-5 py-3">
            <div className="min-w-0">
              <Link to={nav ? `${nav.id}/${r.id}` : ''} className="truncate text-sm font-medium text-slate-900 hover:text-primary">
                {String(r[entity.champTitre] ?? '')}
              </Link>
              <p className="truncate text-xs text-slate-500">{secondary.map((c) => formatValue(r[c.id], c.type)).join(' · ')}</p>
            </div>
            {entity.champStatut && r[entity.champStatut] && (
              <Badge color={statusColor(String(r[entity.champStatut]), entity.champs.find((c) => c.id === entity.champStatut)?.couleurs)}>{String(r[entity.champStatut])}</Badge>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}
