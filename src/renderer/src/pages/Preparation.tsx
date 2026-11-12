// Rendez-vous à venir : préparation automatique, brief de départ, maquette de départ, identité, interlocuteurs.
import { useState } from 'react'
import { allFields, progress } from '@shared/brief/schema'
import type { Rdv } from '@shared/types'
import { prospectOf, useApp } from '../lib/data'
import { CONTEXTES, dateCourte, heure, jour, relatif } from '../lib/format'
import { go, href } from '../lib/router'
import { Page } from '../shell/Shell'
import { Icon } from '../ui/icons'
import { Avatar, Card, Logo, StatutBadge, StepIcon } from '../ui/kit'

export function Preparation({ rdv, onStart, onEdit }: { rdv: Rdv; onStart: () => void; onEdit: () => void }) {
  const { data, templates, toast } = useApp()
  const p = prospectOf(data, rdv)
  const brand = rdv.brand ?? p?.brand
  const previous = rdv.repriseDe ? data.rdvs.find((r) => r.id === rdv.repriseDe) : undefined
  const [confirmDel, setConfirmDel] = useState(false)
  const fin = new Date(Date.parse(rdv.debut) + rdv.dureeMin * 60_000)
  const fields = allFields(rdv.brief)
  const connus = fields.filter((f) => rdv.brief.champs[f.id]?.status !== 'manquant' && rdv.brief.champs[f.id])
  const cles = fields.filter((f) => f.priorite === 1 && rdv.brief.champs[f.id]?.status === 'manquant')
  const preparing = rdv.statut === 'preparation'
  const template = templates.find((t) => t.id === rdv.maquette.templateId)

  const relancer = async () => {
    try {
      await window.autobuild.prepareRdv(rdv.id)
      toast('Rendez-vous prêt.')
    } catch (err) {
      toast(`Préparation impossible : ${(err as Error).message}`, true)
    }
  }

  return (
    <>
      <section className="card" style={{ borderRadius: 0, borderWidth: '0 0 1px 0', padding: '22px 32px', display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between' }} aria-label={`Rendez-vous ${p?.nom}`}>
        <div className="row" style={{ gap: 16, minWidth: 0 }}>
          <Logo nom={p?.nom ?? '?'} brand={brand} size={52} />
          <div style={{ minWidth: 0 }}>
            <div className="row wrap" style={{ gap: 10 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700 }}>
                {p?.nom} · {rdv.titre.toLowerCase()}
              </h1>
              <StatutBadge rdv={rdv} />
              {rdv.scenarioId && <span className="badge wip">Démonstration</span>}
            </div>
            <p className="muted" style={{ marginTop: 4 }}>
              {jour(rdv.debut)} {heure(rdv.debut)} – {heure(fin.getTime())} · {relatif(rdv.debut)} · {rdv.scenarioId ? 'Conversation rejouée' : CONTEXTES[rdv.contexte]}
              {rdv.commercial ? ` · ${rdv.commercial}` : ''}
            </p>
          </div>
        </div>
        <div className="row">
          {rdv.lienVisio && (
            <button className="btn" onClick={() => void window.autobuild.openExternal(rdv.lienVisio!)}>
              <Icon name="video" size={16} /> Ouvrir la visio
            </button>
          )}
          <button className="btn" onClick={onEdit}>
            <Icon name="edit" size={16} /> Modifier
          </button>
          <button className="btn rec lg" onClick={onStart} disabled={rdv.statut === 'en_cours'}>
            <span className="recdot" />
            Démarrer le rendez-vous
          </button>
        </div>
      </section>
      <Page>
        <div className="split">
          <div className="main">
            <Card
              title="Préparation automatique"
              action={
                rdv.statut === 'erreur' || rdv.statut === 'a_preparer' ? (
                  <button className="btn sm primary" onClick={() => void relancer()}>
                    <Icon name="refresh" size={14} /> {rdv.statut === 'erreur' ? 'Relancer' : 'Préparer maintenant'}
                  </button>
                ) : rdv.statut === 'pret' ? (
                  <button className="btn sm ghost" onClick={() => void relancer()} title="Refaire l’identité et la maquette de départ">
                    <Icon name="refresh" size={14} /> Refaire
                  </button>
                ) : undefined
              }
            >
              <ol className="steps-list" style={{ padding: '18px 20px' }}>
                {rdv.preparation.etapes.map((e) => (
                  <li key={e.id} className="step-item">
                    <StepIcon etat={e.statut === 'ok' ? 'fait' : e.statut} />
                    <span>
                      <span style={{ display: 'block', fontWeight: 600, color: e.statut === 'attente' ? 'var(--ink-3)' : undefined }}>{e.label}</span>
                      <span className="small muted">{e.detail ?? (e.statut === 'attente' ? (preparing ? 'En attente…' : 'Pas encore fait') : '')}</span>
                    </span>
                  </li>
                ))}
              </ol>
              {rdv.preparation.erreur && (
                <p className="small" style={{ margin: '0 20px 18px', padding: '10px 12px', borderRadius: 10, background: 'var(--err-soft)', color: 'var(--err)' }}>
                  {rdv.preparation.erreur}
                </p>
              )}
              {rdv.statut === 'a_preparer' && !p?.siteUrl && !rdv.scenarioId && (
                <p className="small" style={{ margin: '0 20px 18px', padding: '10px 12px', borderRadius: 10, background: 'var(--warn-soft)', color: 'var(--warn)' }}>
                  Ajoutez le site web du prospect (Modifier) pour récupérer son logo et ses couleurs.
                </p>
              )}
            </Card>

            <Card title="Brief de départ" action={<span className="badge ok">{progress(rdv.brief).pct} %</span>}>
              <p className="small muted" style={{ padding: '12px 20px 0' }}>
                {previous ? `Repris du rendez-vous du ${dateCourte(previous.debut)}.` : 'Ce que l’on sait déjà, avant l’appel.'}
              </p>
              <div className="grid2" style={{ padding: '14px 20px 20px', gap: 24 }}>
                <div className="stack" style={{ gap: 10 }}>
                  <p className="section-title">Déjà connu · {connus.length}</p>
                  {connus.length === 0 && <p className="small muted">Rien pour l’instant.</p>}
                  {connus.slice(0, 8).map((f) => {
                    const c = rdv.brief.champs[f.id]
                    const src = c.preuves[0]?.source
                    return (
                      <p key={f.id} className="small">
                        <b>{f.label}</b>
                        <span style={{ display: 'block', color: 'var(--ink-2)' }}>{c.valeur ?? c.items?.map((i) => i.nom).join(', ')}</span>
                        <span className="xs muted">{src === 'site' ? 'D’après le site web' : src === 'saisie' ? 'Saisi par vous' : 'Rendez-vous précédent'}</span>
                      </p>
                    )
                  })}
                </div>
                <div className="stack" style={{ gap: 8 }}>
                  <p className="section-title">Infos clés à obtenir · {cles.length}</p>
                  {cles.map((f) => (
                    <p key={f.id} className="row small" style={{ color: 'var(--ink-2)' }}>
                      <span style={{ width: 9, height: 9, borderRadius: 99, border: '1.5px solid var(--ink-4)' }} />
                      {f.label}
                    </p>
                  ))}
                  <p className="xs muted" style={{ marginTop: 4 }}>
                    D’autres infos s’ajoutent pendant l’appel selon le projet.
                  </p>
                </div>
              </div>
            </Card>

            <Card title="Maquette de départ" action={template && <a className="link" href={href({ page: 'template', id: template.id })}>Voir le template</a>}>
              <div className="row wrap" style={{ padding: 20, gap: 20, alignItems: 'flex-start' }}>
                <MiniMaquette couleur={brand?.couleurs.primaire ?? template?.couleur ?? '#4f46e5'} layout={template?.layout} />
                <div className="stack" style={{ flex: 1, minWidth: 260 }}>
                  <p className="small" style={{ color: 'var(--ink-2)' }}>
                    {rdv.statut === 'pret'
                      ? `${previous ? 'Maquette du rendez-vous précédent' : 'Connexion, tableau de bord et premières pages'} aux couleurs de ${p?.nom}. L’IA complète le reste pendant l’appel.`
                      : 'Générée pendant la préparation.'}
                  </p>
                  <label className="field">
                    Template
                    <select className="input" value={rdv.templateChoisi} onChange={(e) => void window.autobuild.updateRdv(rdv.id, { templateChoisi: e.target.value })} disabled={preparing}>
                      <option value="auto">Automatique{template && rdv.templateChoisi === 'auto' ? ` (pour l’instant : ${template.name})` : ''}</option>
                      {templates
                        .filter((t) => t.ready)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="row">
                    <button className="btn sm" disabled={rdv.statut !== 'pret'} onClick={() => void window.autobuild.presentMaquette(rdv.id).catch((e: Error) => toast(e.message, true))}>
                      <Icon name="present" size={15} /> Aperçu
                    </button>
                    <button className="btn sm ghost" disabled={!rdv.maquette.workspace} onClick={() => void window.autobuild.openMaquetteFolder(rdv.id)}>
                      <Icon name="folder" size={15} /> Dossier
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <aside className="side">
            <Card title="Identité visuelle" action={p && <a className="link" href={href({ page: 'prospects', id: p.id })}>Fiche prospect</a>}>
              <div style={{ padding: 20 }} className="stack">
                {brand && (p?.siteUrl || rdv.scenarioId) ? (
                  <>
                    <div className="row">
                      {[brand.couleurs.primaire, brand.couleurs.secondaire, brand.couleurs.accent].filter(Boolean).map((c) => (
                        <span key={c} className="swatch" title={c} style={{ background: c }} />
                      ))}
                    </div>
                    <dl className="small" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 14px' }}>
                      {brand.police && (
                        <>
                          <dt className="muted">Police</dt>
                          <dd>{brand.police}</dd>
                        </>
                      )}
                      {brand.ton && (
                        <>
                          <dt className="muted">Ton</dt>
                          <dd>{brand.ton}</dd>
                        </>
                      )}
                      {p?.siteUrl && (
                        <>
                          <dt className="muted">Site</dt>
                          <dd className="ellipsis">
                            <button className="link" onClick={() => void window.autobuild.openExternal(p.siteUrl!)}>
                              {p.siteUrl.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                            </button>
                          </dd>
                        </>
                      )}
                    </dl>
                  </>
                ) : (
                  <p className="small muted">{p?.siteUrl || rdv.scenarioId ? 'Récupérée pendant la préparation.' : 'Pas de site renseigné : la maquette utilisera une palette neutre.'}</p>
                )}
              </div>
            </Card>
            <Card title="Interlocuteurs">
              {rdv.interlocuteurs.length === 0 && <p className="small muted" style={{ padding: '14px 20px' }}>Aucun interlocuteur renseigné.</p>}
              {rdv.interlocuteurs.map((c) => (
                <div key={c.nom} className="rowlink">
                  <Avatar nom={c.nom} />
                  <span>
                    <b style={{ display: 'block' }}>{c.nom}</b>
                    <span className="small muted">{c.fonction}</span>
                  </span>
                </div>
              ))}
            </Card>
            {rdv.notes && (
              <Card title="Notes pour l’IA">
                <p className="small" style={{ padding: '14px 20px', whiteSpace: 'pre-wrap', color: 'var(--ink-2)' }}>
                  {rdv.notes}
                </p>
              </Card>
            )}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              {confirmDel ? (
                <>
                  <span className="small muted">Supprimer ce rendez-vous ?</span>
                  <button className="btn sm" onClick={() => setConfirmDel(false)}>
                    Non
                  </button>
                  <button
                    className="btn sm danger"
                    onClick={async () => {
                      await window.autobuild.deleteRdv(rdv.id)
                      go({ page: 'rdvs' })
                    }}
                  >
                    Supprimer
                  </button>
                </>
              ) : (
                <button className="btn sm ghost danger" onClick={() => setConfirmDel(true)}>
                  <Icon name="trash" size={14} /> Supprimer le rendez-vous
                </button>
              )}
            </div>
          </aside>
        </div>
      </Page>
    </>
  )
}

/** Vignette schématique d'une maquette (barre latérale ou menu horizontal). */
export function MiniMaquette({ couleur, layout, width = 220 }: { couleur: string; layout?: 'sidebar' | 'topnav'; width?: number }) {
  const h = Math.round(width * 0.62)
  return (
    <div aria-hidden="true" style={{ width, height: h, borderRadius: 10, border: '1px solid var(--line)', background: '#f8fafc', overflow: 'hidden', display: 'flex', flexDirection: layout === 'topnav' ? 'column' : 'row', flexShrink: 0 }}>
      {layout === 'topnav' ? (
        <div style={{ height: 22, background: '#fff', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px' }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: couleur }} />
          {[28, 22, 26, 20].map((w, i) => (
            <span key={i} style={{ width: w, height: 4, borderRadius: 2, background: i === 0 ? couleur : '#d1d5db' }} />
          ))}
        </div>
      ) : (
        <div style={{ width: '24%', background: '#fff', borderRight: '1px solid var(--line)', padding: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ width: 14, height: 14, borderRadius: 4, background: couleur }} />
          {[1, 0, 0, 0, 0].map((on, i) => (
            <span key={i} style={{ height: 5, borderRadius: 2, background: on ? couleur : '#e5e7eb', opacity: on ? 0.5 : 1 }} />
          ))}
        </div>
      )}
      <div style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ width: '45%', height: 6, borderRadius: 2, background: '#cbd5e1' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ height: 18, borderRadius: 4, background: '#fff', border: '1px solid #e5e7eb' }} />
          ))}
        </div>
        <div style={{ flex: 1, borderRadius: 4, background: '#fff', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'flex-end', gap: 3, padding: 5 }}>
          {[40, 65, 50, 80, 60, 72].map((v, i) => (
            <span key={i} style={{ flex: 1, height: `${v}%`, borderRadius: 2, background: couleur, opacity: 0.8 }} />
          ))}
        </div>
      </div>
    </div>
  )
}
