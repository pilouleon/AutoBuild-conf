// Liste de tous les rendez-vous (à venir, passés) et vue calendrier.
import { useMemo, useState } from 'react'
import { progress } from '@shared/brief/schema'
import { PROJECT_TYPES } from '@shared/catalog'
import type { Rdv } from '@shared/types'
import { past, prospectOf, upcoming, useApp } from '../lib/data'
import { cap, dateCourte, heure, startOfDay, typeLabel } from '../lib/format'
import { type Route, go, href } from '../lib/router'
import { Page } from '../shell/Shell'
import { Icon } from '../ui/icons'
import { Empty, Logo, Segmented, StatutBadge, cx } from '../ui/kit'

export function RendezVous({ route, onNew }: { route: Extract<Route, { page: 'rdvs' }>; onNew: () => void }) {
  const { data } = useApp()
  const filtre = route.filtre ?? 'tous'
  const vue = route.vue ?? 'liste'
  const [q, setQ] = useState('')
  const [type, setType] = useState('')
  const match = (r: Rdv) => {
    const p = prospectOf(data, r)
    const t = `${p?.nom ?? ''} ${r.interlocuteurs.map((c) => c.nom).join(' ')} ${r.notes}`.toLowerCase()
    return (!q || t.includes(q.toLowerCase())) && (!type || (r.brief.typeProjet ?? r.typePressenti) === type)
  }
  const avenir = upcoming(data).filter(match)
  const passes = past(data).filter(match)
  const types = [...new Set(data.rdvs.map((r) => r.brief.typeProjet ?? r.typePressenti).filter(Boolean))] as string[]

  return (
    <Page>
      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
        <div>
          <h1 className="h1">Rendez-vous</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Tous vos rendez-vous : à préparer, prêts, en cours et passés, avec leur brief, leur transcription et leur maquette.
          </p>
        </div>
        <Segmented label="Affichage" value={vue} options={[{ value: 'liste', label: 'Liste' }, { value: 'calendrier', label: 'Calendrier' }]} onChange={(v) => go({ page: 'rdvs', vue: v, filtre })} />
      </div>
      {vue === 'liste' && (
        <div className="tabs" role="navigation" aria-label="Filtrer par période">
          {(
            [
              ['tous', 'Tous', avenir.length + passes.length],
              ['avenir', 'À venir', avenir.length],
              ['passes', 'Passés', passes.length]
            ] as const
          ).map(([id, l, n]) => (
            <a key={id} className={cx('tab', filtre === id && 'on')} href={href({ page: 'rdvs', filtre: id })} aria-current={filtre === id ? 'page' : undefined}>
              {l} <span className="n">{n}</span>
            </a>
          ))}
        </div>
      )}
      <div className="row wrap" style={{ gap: 12 }}>
        <label className="search" style={{ flex: '1 1 280px', maxWidth: 420 }}>
          <Icon name="search" size={16} />
          <input aria-label="Rechercher un rendez-vous" placeholder="Rechercher un prospect, un interlocuteur…" value={q} onChange={(e) => setQ(e.target.value)} style={{ border: 0, background: 'transparent', outline: 'none', flex: 1 }} />
        </label>
        <label className="row small muted" style={{ fontWeight: 600 }}>
          Type de projet
          <select className="input" style={{ width: 230 }} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Tous</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {PROJECT_TYPES.find((p) => p.id === t)?.label ?? t}
              </option>
            ))}
          </select>
        </label>
      </div>
      {data.rdvs.length === 0 ? (
        <div className="card">
          <Empty icon="calendar" title="Aucun rendez-vous" text="Créez un rendez-vous à l’avance : AutoBuild prépare la maquette de départ avant l’appel.">
            <button className="btn primary" onClick={onNew}>
              Nouveau rendez-vous
            </button>
          </Empty>
        </div>
      ) : vue === 'calendrier' ? (
        <Calendrier rdvs={[...avenir, ...passes]} />
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 120 }}>Date</th>
                <th>Prospect</th>
                <th>Type de projet</th>
                <th style={{ width: 150 }}>Brief</th>
                <th style={{ width: 170 }}>Statut</th>
                <th style={{ width: 90 }}>
                  <span style={{ position: 'absolute', left: -9999 }}>Ouvrir</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtre !== 'passes' && avenir.length > 0 && (
                <tr>
                  <td colSpan={6} className="group">
                    À venir
                  </td>
                </tr>
              )}
              {filtre !== 'passes' && avenir.map((r) => <Ligne key={r.id} rdv={r} />)}
              {filtre !== 'avenir' && passes.length > 0 && (
                <tr>
                  <td colSpan={6} className="group">
                    Passés
                  </td>
                </tr>
              )}
              {filtre !== 'avenir' && passes.map((r) => <Ligne key={r.id} rdv={r} />)}
              {((filtre === 'avenir' && !avenir.length) || (filtre === 'passes' && !passes.length) || (!avenir.length && !passes.length)) && (
                <tr>
                  <td colSpan={6} className="muted small" style={{ padding: 24, textAlign: 'center' }}>
                    Aucun rendez-vous.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  )
}

function Ligne({ rdv }: { rdv: Rdv }) {
  const { data } = useApp()
  const p = prospectOf(data, rdv)
  const termine = rdv.statut === 'termine'
  const pct = progress(rdv.brief).pct
  return (
    <tr className="clickable" onClick={() => go({ page: 'rdv', id: rdv.id })}>
      <td>
        <b>{dateCourte(rdv.debut)}</b> <span className="muted tabular">{heure(rdv.debut)}</span>
      </td>
      <td>
        <div className="row" style={{ gap: 12 }}>
          <Logo nom={p?.nom ?? '?'} brand={rdv.brand ?? p?.brand} size={32} />
          <span style={{ minWidth: 0 }}>
            <a href={href({ page: 'rdv', id: rdv.id })} style={{ display: 'block', fontWeight: 600 }} onClick={(e) => e.stopPropagation()}>
              {p?.nom}
              {rdv.titre !== 'Premier rendez-vous' && <span className="muted" style={{ fontWeight: 500 }}> · {rdv.titre}</span>}
            </a>
            <span className="small muted">{rdv.interlocuteurs.map((c) => c.nom).join(', ') || '—'}</span>
          </span>
        </div>
      </td>
      <td className="small">{typeLabel(rdv)}</td>
      <td>
        {termine || pct > 0 ? (
          <span className="row" style={{ gap: 8 }}>
            <span className="progress" style={{ width: 70 }}>
              <div style={{ width: `${pct}%` }} />
            </span>
            <span className="small strong tabular">{pct} %</span>
          </span>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td>
        <StatutBadge rdv={rdv} />
      </td>
      <td>
        <a className="link" href={href({ page: 'rdv', id: rdv.id })} onClick={(e) => e.stopPropagation()}>
          {termine ? 'Ouvrir' : 'Préparer'}
        </a>
      </td>
    </tr>
  )
}

const JOURS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.']

function Calendrier({ rdvs }: { rdvs: Rdv[] }) {
  const { data } = useApp()
  const [mois, setMois] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const cells = useMemo(() => {
    const first = new Date(mois)
    const start = new Date(first)
    start.setDate(1 - ((first.getDay() + 6) % 7))
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      return d
    })
  }, [mois])
  const today = startOfDay(Date.now())
  return (
    <div className="card">
      <div className="card-head">
        <div className="row">
          <button className="iconbtn" aria-label="Mois précédent" onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() - 1, 1))}>
            <Icon name="back" />
          </button>
          <button className="iconbtn" aria-label="Mois suivant" onClick={() => setMois(new Date(mois.getFullYear(), mois.getMonth() + 1, 1))}>
            <Icon name="chevron" />
          </button>
          <h2>{cap(mois.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))}</h2>
        </div>
        <button className="btn sm" onClick={() => setMois(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
          Aujourd’hui
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
        {JOURS.map((j) => (
          <div key={j} className="xs muted strong" style={{ padding: '8px 10px', borderBottom: '1px solid var(--line-2)' }}>
            {j}
          </div>
        ))}
        {cells.map((d) => {
          const inMonth = d.getMonth() === mois.getMonth()
          const list = rdvs.filter((r) => startOfDay(new Date(r.debut)) === startOfDay(d)).sort((a, b) => a.debut.localeCompare(b.debut))
          return (
            <div key={d.toISOString()} style={{ minHeight: 104, padding: 6, borderBottom: '1px solid var(--line-3)', borderRight: '1px solid var(--line-3)', background: inMonth ? '#fff' : '#fafbfc' }}>
              <span className="xs" style={{ display: 'inline-grid', placeItems: 'center', width: 24, height: 24, borderRadius: 99, fontWeight: 600, color: startOfDay(d) === today ? '#fff' : inMonth ? 'var(--ink-2)' : 'var(--ink-4)', background: startOfDay(d) === today ? 'var(--rec)' : 'transparent' }}>
                {d.getDate()}
              </span>
              {list.map((r) => {
                const p = prospectOf(data, r)
                const done = r.statut === 'termine'
                return (
                  <a key={r.id} href={href({ page: 'rdv', id: r.id })} className="ellipsis" style={{ display: 'block', marginTop: 4, padding: '3px 6px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: done ? 'var(--neutral-soft)' : 'var(--accent-soft)', color: done ? 'var(--ink-2)' : 'var(--accent-ink)' }}>
                    {heure(r.debut)} {p?.nom}
                  </a>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
