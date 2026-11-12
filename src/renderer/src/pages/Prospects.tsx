// Prospects : liste des entreprises et fiche (rendez-vous, interlocuteurs, identité visuelle, maquettes, notes).
import { useEffect, useState } from 'react'
import { progress } from '@shared/brief/schema'
import type { Contact, Prospect } from '@shared/types'
import { useApp } from '../lib/data'
import { dateCourte, heure, jour, pluriel, typeLabel } from '../lib/format'
import { href } from '../lib/router'
import { Icon } from '../ui/icons'
import { Avatar, Card, Empty, Logo, StatutBadge, cx } from '../ui/kit'

export function Prospects({ id, onNew }: { id?: string; onNew: (prospectId?: string) => void }) {
  const { data } = useApp()
  const [q, setQ] = useState('')
  const list = [...data.prospects]
    .filter((p) => !q || p.nom.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      const last = (p: Prospect) => Math.max(0, ...data.rdvs.filter((r) => r.prospectId === p.id).map((r) => Date.parse(r.debut)))
      return last(b) - last(a)
    })
  const sel = data.prospects.find((p) => p.id === id) ?? list[0]
  useEffect(() => {
    if (!id && sel) history.replaceState(null, '', href({ page: 'prospects', id: sel.id }))
  }, [id, sel?.id])

  if (data.prospects.length === 0)
    return (
      <div style={{ padding: 32 }}>
        <div className="card">
          <Empty icon="building" title="Aucun prospect" text="Les entreprises sont ajoutées automatiquement quand vous créez un rendez-vous.">
            <button className="btn primary" onClick={() => onNew()}>
              Nouveau rendez-vous
            </button>
          </Empty>
        </div>
      </div>
    )

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, height: '100%' }}>
      <section aria-label="Liste des prospects" style={{ width: 320, flexShrink: 0, borderRight: '1px solid var(--line)', background: '#fff', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '22px 20px 12px' }} className="stack">
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>Prospects · {data.prospects.length}</h1>
          <label className="search" style={{ minWidth: 0 }}>
            <Icon name="search" size={16} />
            <input aria-label="Rechercher un prospect" placeholder="Rechercher" value={q} onChange={(e) => setQ(e.target.value)} style={{ border: 0, background: 'transparent', outline: 'none', flex: 1, minWidth: 0 }} />
          </label>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 10px 12px' }}>
          {list.map((p) => {
            const rdvs = data.rdvs.filter((r) => r.prospectId === p.id)
            const next = rdvs.filter((r) => r.statut !== 'termine').sort((a, b) => a.debut.localeCompare(b.debut))[0]
            const t = rdvs.find((r) => r.brief.typeProjet)
            return (
              <a key={p.id} href={href({ page: 'prospects', id: p.id })} className={cx('nav-item', sel?.id === p.id && 'on')} style={{ gap: 12, padding: 10 }} aria-current={sel?.id === p.id ? 'page' : undefined}>
                <Logo nom={p.nom} brand={p.brand} size={36} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="ellipsis" style={{ display: 'block', fontWeight: 600, color: 'var(--ink)' }}>
                    {p.nom}
                  </span>
                  <span className="xs muted ellipsis" style={{ display: 'block', fontWeight: 400 }}>
                    {next ? `RDV ${jour(next.debut).toLowerCase()} ${heure(next.debut)}` : `${pluriel(rdvs.length, 'RDV', 'RDV')}${t ? ` · ${typeLabel(t)}` : ''}`}
                  </span>
                </span>
              </a>
            )
          })}
        </div>
      </section>
      <div className="scroll" style={{ flex: 1 }}>{sel && <Fiche key={sel.id} p={sel} onNew={onNew} />}</div>
    </div>
  )
}

function Fiche({ p, onNew }: { p: Prospect; onNew: (prospectId?: string) => void }) {
  const { data, toast } = useApp()
  const rdvs = data.rdvs.filter((r) => r.prospectId === p.id).sort((a, b) => b.debut.localeCompare(a.debut))
  const [notes, setNotes] = useState(p.notes ?? '')
  const [contact, setContact] = useState<Contact | null>(null)
  const b = p.brand
  const save = (patch: Partial<Prospect>) => void window.autobuild.updateProspect(p.id, patch).then(() => toast('Fiche mise à jour.'))
  const maquettes = rdvs.filter((r) => r.maquette.workspace && r.maquette.versions.length)
  return (
    <main className="page" style={{ maxWidth: 1000 }}>
      <header className="row wrap" style={{ justifyContent: 'space-between', gap: 16 }}>
        <div className="row" style={{ gap: 16, minWidth: 0 }}>
          <Logo nom={p.nom} brand={b} size={56} />
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700 }}>{p.nom}</h2>
            <p className="muted">
              {[p.secteur, b?.slogan].filter(Boolean).join(' · ')}
              {p.siteUrl && (
                <>
                  {p.secteur || b?.slogan ? ' · ' : ''}
                  <button className="link" onClick={() => void window.autobuild.openExternal(p.siteUrl!)}>
                    {p.siteUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
        <button className="btn primary" onClick={() => onNew(p.id)}>
          <Icon name="plus" size={16} /> Nouveau rendez-vous
        </button>
      </header>
      <Card title="Rendez-vous">
        {rdvs.map((r) => (
          <a key={r.id} href={href({ page: 'rdv', id: r.id })} className="rowlink">
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'block' }}>{r.titre}</b>
              <span className="small muted">
                {jour(r.debut)} {heure(r.debut)}
                {r.interlocuteurs[0] ? ` · ${r.interlocuteurs[0].nom}` : ''} · {typeLabel(r)}
                {r.statut === 'termine' ? ` · brief ${progress(r.brief).pct} %` : ''}
              </span>
            </span>
            <StatutBadge rdv={r} />
          </a>
        ))}
        <button className="rowlink muted" onClick={() => onNew(p.id)}>
          <Icon name="plus" size={16} /> Planifier un rendez-vous
        </button>
      </Card>
      <div className="grid2" style={{ gap: 24, alignItems: 'start' }}>
        <Card title="Interlocuteurs" action={<button className="link" onClick={() => setContact({ nom: '', fonction: '' })}>Ajouter</button>}>
          {p.interlocuteurs.length === 0 && !contact && <p className="small muted" style={{ padding: '14px 20px' }}>Aucun interlocuteur.</p>}
          {p.interlocuteurs.map((c) => (
            <div key={c.nom} className="rowlink">
              <Avatar nom={c.nom} />
              <span style={{ flex: 1 }}>
                <b style={{ display: 'block' }}>{c.nom}</b>
                <span className="small muted">{c.fonction}</span>
              </span>
              <button className="iconbtn" aria-label={`Retirer ${c.nom}`} onClick={() => save({ interlocuteurs: p.interlocuteurs.filter((x) => x !== c) })}>
                <Icon name="x" size={14} />
              </button>
            </div>
          ))}
          {contact && (
            <div className="stack" style={{ padding: '12px 20px', gap: 8 }}>
              <input className="input" placeholder="Prénom Nom" value={contact.nom} onChange={(e) => setContact({ ...contact, nom: e.target.value })} autoFocus />
              <input className="input" placeholder="Fonction" value={contact.fonction} onChange={(e) => setContact({ ...contact, fonction: e.target.value })} />
              <div className="row">
                <button className="btn sm ghost" onClick={() => setContact(null)}>
                  Annuler
                </button>
                <button
                  className="btn sm primary"
                  disabled={!contact.nom.trim()}
                  onClick={() => {
                    save({ interlocuteurs: [...p.interlocuteurs, contact] })
                    setContact(null)
                  }}
                >
                  Ajouter
                </button>
              </div>
            </div>
          )}
        </Card>
        <Card title="Identité visuelle">
          <div style={{ padding: 20 }} className="stack">
            {b ? (
              <>
                <div className="row">
                  {[b.couleurs.primaire, b.couleurs.secondaire, b.couleurs.accent].filter(Boolean).map((c) => (
                    <span key={c} className="row xs muted" style={{ gap: 6 }}>
                      <span className="swatch" style={{ background: c }} />
                      {c}
                    </span>
                  ))}
                </div>
                <p className="small" style={{ color: 'var(--ink-2)' }}>
                  {[b.police, b.ton && `ton ${b.ton}`, b.slogan && `accroche « ${b.slogan} »`].filter(Boolean).join(' · ') || 'Couleurs récupérées sur le site.'}
                </p>
                {b.description && <p className="small muted">{b.description}</p>}
              </>
            ) : (
              <p className="small muted">Récupérée sur le site du prospect lors de la préparation d’un rendez-vous.</p>
            )}
          </div>
        </Card>
      </div>
      <Card title="Maquettes">
        {maquettes.length === 0 && <p className="small muted" style={{ padding: '14px 20px' }}>Aucune maquette pour l’instant.</p>}
        {maquettes.map((r) => (
          <div key={r.id} className="rowlink">
            <Icon name="window" style={{ color: 'var(--ink-3)' }} />
            <a href={href({ page: 'rdv', id: r.id, tab: r.statut === 'termine' ? 'maquette' : undefined })} style={{ flex: 1, minWidth: 0 }}>
              <b style={{ display: 'block' }}>{r.statut === 'termine' ? `Maquette du ${dateCourte(r.debut)}` : 'Maquette de départ'}</b>
              <span className="small muted">
                {r.maquette.templateName ?? ''} · {pluriel(r.maquette.versions.length, 'version')}
              </span>
            </a>
            <button className="btn sm" onClick={() => void window.autobuild.presentMaquette(r.id).catch((e: Error) => toast(e.message, true))}>
              Présenter
            </button>
          </div>
        ))}
      </Card>
      <Card title="Notes">
        <div style={{ padding: 20 }} className="stack">
          <textarea className="input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes internes sur ce prospect" />
          <button className="btn sm" style={{ alignSelf: 'flex-end' }} disabled={notes === (p.notes ?? '')} onClick={() => save({ notes })}>
            Enregistrer
          </button>
        </div>
      </Card>
    </main>
  )
}
