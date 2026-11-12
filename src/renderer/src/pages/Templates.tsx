// Templates : bibliothèque (intégrés + agence) et détail d'un template (pages base / options, infos à obtenir).
import { useState } from 'react'
import { PROJECT_TYPES, type ProjectType, getProjectType } from '@shared/catalog'
import type { TemplateInfo, TemplatePage } from '@shared/types'
import { useApp } from '../lib/data'
import { pluriel } from '../lib/format'
import { go, href } from '../lib/router'
import { Page } from '../shell/Shell'
import { Icon } from '../ui/icons'
import { Card, Empty, cx } from '../ui/kit'
import { MiniMaquette } from './Preparation'

const FAMILLES: { id: ProjectType['famille'] | 'tous'; label: string }[] = [
  { id: 'tous', label: 'Tous' },
  { id: 'gestion', label: 'Gestion' },
  { id: 'portail', label: 'Portails' },
  { id: 'metier', label: 'Métier' }
]

function familles(t: TemplateInfo): Set<string> {
  return new Set(t.projectTypes.map((id) => getProjectType(id)?.famille).filter(Boolean) as string[])
}

export function Templates() {
  const { templates, data } = useApp()
  const [famille, setFamille] = useState<(typeof FAMILLES)[number]['id']>('tous')
  const visibles = templates.filter((t) => t.id !== 'socle' && (famille === 'tous' || familles(t).has(famille)))
  const couverts = new Set(templates.filter((t) => t.id !== 'socle').flatMap((t) => t.projectTypes))
  const restants = PROJECT_TYPES.filter((p) => !couverts.has(p.id))
  const usage = (id: string) => data.rdvs.filter((r) => r.maquette.templateId === id).length
  return (
    <Page>
      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
        <div style={{ maxWidth: 760 }}>
          <h1 className="h1">Templates</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Des applications complètes avec leur bibliothèque de pages. Pendant l’appel, le template s’ajuste au projet, active les pages dont le prospect parle et l’IA les adapte.
          </p>
        </div>
        <a className="btn" href={href({ page: 'reglages', section: 'templates' })}>
          <Icon name="folder" size={16} /> Templates de l’agence
        </a>
      </div>
      <div className="chips">
        {FAMILLES.map((f) => (
          <button key={f.id} className={cx('chip', famille === f.id && 'on')} aria-pressed={famille === f.id} onClick={() => setFamille(f.id)}>
            {f.label}
            {f.id === 'tous' ? ` · ${templates.filter((t) => t.id !== 'socle').length}` : ''}
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
        {visibles.map((t) => (
          <a key={t.id} href={href({ page: 'template', id: t.id })} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 18, background: `${t.couleur ?? '#475569'}12`, display: 'grid', placeItems: 'center' }}>
              <MiniMaquette couleur={t.couleur ?? '#475569'} layout={t.layout} width={230} />
            </div>
            <div style={{ padding: '14px 18px 16px' }} className="stack">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{t.name}</b>
                <span className={cx('badge', t.source === 'agence' ? 'todo' : '')}>{t.source === 'agence' ? 'Agence' : 'Intégré'}</span>
              </div>
              <p className="small muted" style={{ marginTop: -4 }}>
                {t.description}
              </p>
              <p className="xs muted">
                {pluriel(t.pages.length, 'page')} · {t.layout === 'topnav' ? 'menu horizontal' : 'menu latéral'} · utilisé dans {pluriel(usage(t.id), 'RDV', 'RDV')}
              </p>
              {!t.ready && <p className="xs" style={{ color: 'var(--err)' }}>{t.problem}</p>}
            </div>
          </a>
        ))}
      </div>
      {visibles.length === 0 && <div className="card"><Empty icon="layers" title="Aucun template dans cette famille" /></div>}
      {restants.length > 0 && famille === 'tous' && (
        <Card title="Autres types de projets">
          <p className="small muted" style={{ padding: '12px 20px 0' }}>
            Pas encore de template dédié : la maquette part du template générique, et l’IA l’adapte pendant l’appel.
          </p>
          <div className="chips" style={{ padding: '12px 20px 18px' }}>
            {restants.map((p) => (
              <span key={p.id} className="chip" title={p.description}>
                {p.label}
              </span>
            ))}
          </div>
        </Card>
      )}
    </Page>
  )
}

export function TemplateDetail({ id, pageId }: { id: string; pageId?: string }) {
  const { templates, data } = useApp()
  const t = templates.find((x) => x.id === id)
  const [onglet, setOnglet] = useState<'pages' | 'infos' | 'types'>('pages')
  if (!t) return <Page><div className="card"><Empty icon="layers" title="Template introuvable" /></div></Page>
  const sel = t.pages.find((p) => p.id === pageId)
  const usage = data.rdvs.filter((r) => r.maquette.templateId === t.id).length
  const types = t.projectTypes.map((x) => getProjectType(x)).filter(Boolean) as ProjectType[]
  const infos = types.flatMap((p) => p.champs.map((c) => ({ ...c, type: p.label })))
  return (
    <div className="with-drawer" style={{ minHeight: '100%' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <section style={{ background: '#fff', borderBottom: '1px solid var(--line)', padding: '22px 32px 0' }}>
          <div className="row wrap" style={{ justifyContent: 'space-between', gap: 16 }}>
            <div className="row" style={{ gap: 16 }}>
              <MiniMaquette couleur={t.couleur ?? '#475569'} layout={t.layout} width={96} />
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700 }}>{t.name}</h1>
                <p className="muted">
                  {t.source === 'agence' ? 'Template de l’agence' : 'Template intégré'} · {pluriel(t.pages.length, 'page')} · utilisé dans {pluriel(usage, 'rendez-vous', 'rendez-vous')}
                </p>
              </div>
            </div>
          </div>
          <nav className="tabs" style={{ marginTop: 16, borderBottom: 0 }} aria-label="Sections du template">
            {(
              [
                ['pages', 'Pages', String(t.pages.length)],
                ['infos', 'Infos à obtenir', `+${infos.length}`],
                ['types', 'Types de projets', String(types.length || '')]
              ] as const
            ).map(([k, l, n]) => (
              <button key={k} className={cx('tab', onglet === k && 'on')} onClick={() => setOnglet(k)}>
                {l} {n && <span className="n">{n}</span>}
              </button>
            ))}
          </nav>
        </section>
        <Page>
          {onglet === 'pages' && (
            <>
              <p className="small" style={{ color: 'var(--ink-2)' }}>
                <b>Base</b> : toujours dans la maquette. <b>Option</b> : activée si le prospect en parle (4 au plus au départ). L’IA peut aussi créer une page sur mesure.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                <PageCard p={{ id: 'connexion', label: 'Connexion', description: 'Écran de connexion aux couleurs du prospect.', niveau: 'base', kind: 'page', declencheurs: [], icone: 'shield' }} sel={false} />
                {t.pages.map((p) => (
                  <a key={p.id} href={href({ page: 'template', id: t.id, pageId: p.id })}>
                    <PageCard p={p} sel={sel?.id === p.id} />
                  </a>
                ))}
              </div>
            </>
          )}
          {onglet === 'infos' && (
            <Card title="Infos ajoutées à la checklist">
              <p className="small muted" style={{ padding: '12px 20px 0' }}>
                Dès que le type de projet est identifié pendant l’appel, ces infos s’ajoutent à la grille commune. L’IA peut en ajouter d’autres, propres au prospect.
              </p>
              {infos.map((c) => (
                <div key={`${c.type}-${c.id}`} className="rowlink">
                  <span style={{ flex: 1 }}>
                    <b style={{ display: 'block' }}>{c.label}</b>
                    <span className="small muted">{c.description}</span>
                  </span>
                  <span className="badge">{c.type}</span>
                </div>
              ))}
            </Card>
          )}
          {onglet === 'types' && (
            <Card title="Types de projets couverts">
              {types.map((p) => (
                <div key={p.id} className="rowlink" style={{ alignItems: 'flex-start' }}>
                  <span style={{ flex: 1 }}>
                    <b style={{ display: 'block' }}>{p.label}</b>
                    <span className="small muted">{p.description}</span>
                    <span className="xs muted" style={{ display: 'block', marginTop: 4 }}>
                      Repéré quand le prospect parle de : {p.signaux.slice(0, 6).join(', ')}…
                    </span>
                  </span>
                </div>
              ))}
            </Card>
          )}
        </Page>
      </div>
      {sel && (
        <aside className="drawer" aria-label={`Détail : page ${sel.label}`} style={{ position: 'sticky', top: 0, height: 'calc(100vh - 72px)' }}>
          <div className="sheet-head">
            <div>
              <p className="xs muted">
                {sel.kind === 'entite' ? 'Liste et fiches' : sel.kind === 'tableau-de-bord' ? 'Tableau de bord' : 'Page'} · {sel.niveau === 'base' ? 'base' : 'option'}
              </p>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>{sel.label}</h2>
            </div>
            <button className="iconbtn" aria-label="Fermer le détail" onClick={() => go({ page: 'template', id: t.id })}>
              <Icon name="x" />
            </button>
          </div>
          <div className="sheet-body">
            <p>{sel.description}</p>
            {sel.niveau === 'option' && (
              <div className="stack" style={{ gap: 8 }}>
                <h3 className="section-title">Activée quand le prospect dit</h3>
                <div className="chips">
                  {sel.declencheurs.map((d) => (
                    <span key={d} className="chip">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="stack" style={{ gap: 8 }}>
              <h3 className="section-title">Adaptée avec</h3>
              <ul className="stack small" style={{ gap: 6, color: 'var(--ink-2)' }}>
                {sel.kind === 'entite' && <li>• les champs et statuts cités par le prospect</li>}
                <li>• les objets métier du brief et le vocabulaire du prospect</li>
                <li>• les produits, services et textes de son site</li>
                <li>• son logo, ses couleurs et sa police</li>
              </ul>
            </div>
          </div>
        </aside>
      )}
    </div>
  )
}

function PageCard({ p, sel }: { p: TemplatePage; sel: boolean }) {
  return (
    <div style={{ padding: '14px 16px', borderRadius: 12, background: '#fff', border: sel ? '2px solid var(--accent)' : '1px solid var(--line)', display: 'flex', gap: 12, alignItems: 'center', height: '100%' }}>
      <span style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--soft)', color: 'var(--ink-3)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Icon name={p.kind === 'entite' ? 'list' : p.kind === 'tableau-de-bord' ? 'grid' : 'window'} size={16} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b className="ellipsis" style={{ display: 'block' }}>
          {p.label}
        </b>
        <span className={cx('tag', p.niveau === 'base' ? 'base' : 'opt')}>{p.niveau === 'base' ? 'Base' : 'Option'}</span>
      </span>
    </div>
  )
}
