// Coquille de l'application : navigation latérale, en-tête (fil d'Ariane, recherche ⌘K, nouveau RDV), bandeau du RDV en cours.
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { progress } from '@shared/brief/schema'
import { isLive, nextRdv, prospectOf, upcoming, useApp } from '../lib/data'
import { duree, heure, initiales, jour, relatif, typeLabel } from '../lib/format'
import { type Route, go, href } from '../lib/router'
import { Icon } from '../ui/icons'
import { Logo, cx, useEscape } from '../ui/kit'

export interface Crumb {
  label: string
  to?: Route
}

const NAV: { id: Route['page']; label: string; icon: string; to: Route }[] = [
  { id: 'accueil', label: 'Accueil', icon: 'home', to: { page: 'accueil' } },
  { id: 'rdvs', label: 'Rendez-vous', icon: 'calendar', to: { page: 'rdvs' } },
  { id: 'prospects', label: 'Prospects', icon: 'building', to: { page: 'prospects' } },
  { id: 'templates', label: 'Templates', icon: 'layers', to: { page: 'templates' } }
]

function section(r: Route): Route['page'] {
  if (r.page === 'rdv') return 'rdvs'
  if (r.page === 'template') return 'templates'
  return r.page
}

export function Sidebar({ route, onStart }: { route: Route; onStart: (rdvId: string) => void }) {
  const { data, live, settings, keys } = useApp()
  const active = section(route)
  const next = nextRdv(data)
  const nextProspect = next && prospectOf(data, next)
  const nb = upcoming(data).length
  const iaOk = !!keys?.claude && !!keys?.gemini
  const agence = settings.agence.nom || 'Mon agence'
  return (
    <nav className="sidebar" aria-label="Navigation principale">
      <div className="sb-top">
        <a className="brandmark" href={href({ page: 'accueil' })}>
          <span className="mark">A</span>
          <b>AutoBuild</b>
        </a>
        <a className="agency" href={href({ page: 'reglages', section: 'agence' })}>
          <span className="logo">{initiales(agence)}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="ellipsis" style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>
              {agence}
            </span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)' }}>Agence · données sur ce poste</span>
          </span>
        </a>
      </div>
      <div className="nav">
        {NAV.map((n) => (
          <a key={n.id} href={href(n.to)} className={cx('nav-item', active === n.id && 'on')} aria-current={active === n.id ? 'page' : undefined}>
            <Icon name={n.icon} />
            {n.label}
            {n.id === 'rdvs' && nb > 0 && <span className="count">{nb}</span>}
          </a>
        ))}
      </div>
      {next && nextProspect && !isLive(live) && (
        <div className="next-card">
          <span className="kicker">
            Prochain RDV · {jour(next.debut) === 'Aujourd’hui' ? heure(next.debut) : `${jour(next.debut)} ${heure(next.debut)}`}
          </span>
          <a className="name" href={href({ page: 'rdv', id: next.id })}>
            {nextProspect.nom}
          </a>
          <span className="meta">{next.statut === 'pret' ? 'Prêt · maquette de départ générée' : next.statut === 'preparation' ? 'Préparation en cours…' : next.statut === 'erreur' ? 'Préparation à reprendre' : 'À préparer'}</span>
          <button className="btn rec sm" style={{ marginTop: 4 }} onClick={() => onStart(next.id)}>
            <span className="recdot" />
            Démarrer
          </button>
        </div>
      )}
      <div className="spacer" />
      <div className="sb-bottom">
        <a href={href({ page: 'reglages' })} className={cx('nav-item', active === 'reglages' && 'on')}>
          <Icon name="settings" />
          Réglages
        </a>
        <a href={href({ page: 'aide' })} className={cx('nav-item', active === 'aide' && 'on')}>
          <Icon name="help" />
          Aide et guide
        </a>
        <a className="me" href={href({ page: 'reglages', section: iaOk ? 'profil' : 'ia' })}>
          <span className="avatar">{initiales(settings.profil.nom || 'Moi')}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span className="ellipsis" style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>
              {settings.profil.nom || 'Votre profil'}
            </span>
            <span className="row" style={{ gap: 6, fontSize: 11, color: 'var(--ink-3)' }}>
              <span className={cx('dot', iaOk ? 'ok' : 'warn')} />
              {iaOk ? 'Claude et Gemini connectés' : !keys ? '…' : !keys.claude && !keys.gemini ? 'Accès IA à configurer' : !keys.gemini ? 'Gemini à configurer' : 'Claude à configurer'}
            </span>
          </span>
        </a>
      </div>
    </nav>
  )
}

export function Topbar({ crumbs, onNew }: { crumbs: Crumb[]; onNew: () => void }) {
  const [palette, setPalette] = useState(false)
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette(true)
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
  const mac = window.autobuild.platform === 'darwin'
  return (
    <header className="topbar">
      <nav className="crumbs" aria-label="Fil d'Ariane">
        {crumbs.map((c, i) => (
          <span key={i} className="row" style={{ gap: 8, minWidth: 0 }}>
            {i > 0 && <Icon name="chevron" size={14} style={{ color: 'var(--ink-4)', flexShrink: 0 }} />}
            {c.to && i < crumbs.length - 1 ? (
              <a href={href(c.to)} className="ellipsis">
                {c.label}
              </a>
            ) : (
              <span className={cx('c ellipsis', i === crumbs.length - 1 && 'last')} aria-current={i === crumbs.length - 1 ? 'page' : undefined}>
                {c.label}
              </span>
            )}
          </span>
        ))}
      </nav>
      <button className="search" onClick={() => setPalette(true)}>
        <Icon name="search" size={16} />
        <span style={{ flex: 1 }}>Prospect, rendez-vous, template…</span>
        <span className="kbd">{mac ? '⌘ K' : 'Ctrl K'}</span>
      </button>
      <button className="btn primary" onClick={onNew}>
        <Icon name="plus" size={16} stroke={2.2} />
        Nouveau rendez-vous
      </button>
      {palette && <Palette onClose={() => setPalette(false)} />}
    </header>
  )
}

interface Hit {
  label: string
  detail: string
  to: Route
  icon: string
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Recherche globale : prospects, rendez-vous, templates, réglages. */
function Palette({ onClose }: { onClose: () => void }) {
  const { data, templates } = useApp()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEscape(onClose)
  useEffect(() => {
    input.current?.focus()
  }, [])
  const all = useMemo<Hit[]>(() => {
    const out: Hit[] = []
    for (const p of data.prospects) out.push({ label: p.nom, detail: `Prospect${p.secteur ? ` · ${p.secteur}` : ''}`, to: { page: 'prospects', id: p.id }, icon: 'building' })
    for (const r of [...data.rdvs].sort((a, b) => b.debut.localeCompare(a.debut))) {
      const p = prospectOf(data, r)
      out.push({ label: `${p?.nom ?? ''} · ${r.titre}`, detail: `${jour(r.debut)} ${heure(r.debut)} · ${typeLabel(r)}`, to: { page: 'rdv', id: r.id }, icon: 'calendar' })
    }
    for (const t of templates) out.push({ label: t.name, detail: 'Template', to: { page: 'template', id: t.id }, icon: 'layers' })
    for (const [s, l] of [
      ['ia', 'Accès IA (Claude, Gemini)'],
      ['son', 'Micro et son'],
      ['agence', 'Agence et signature'],
      ['profil', 'Profil'],
      ['widget', 'Widget checklist']
    ])
      out.push({ label: l, detail: 'Réglages', to: { page: 'reglages', section: s }, icon: 'settings' })
    return out
  }, [data, templates])
  const hits = q.trim() ? all.filter((h) => norm(`${h.label} ${h.detail}`).includes(norm(q.trim()))).slice(0, 12) : all.slice(0, 8)
  const open = (h?: Hit) => {
    if (!h) return
    go(h.to)
    onClose()
  }
  return (
    <div className="overlay center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-label="Recherche">
        <input
          ref={input}
          value={q}
          placeholder="Rechercher un prospect, un rendez-vous, un template…"
          onChange={(e) => {
            setQ(e.target.value)
            setSel(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setSel(Math.min(hits.length - 1, sel + 1))
            if (e.key === 'ArrowUp') setSel(Math.max(0, sel - 1))
            if (e.key === 'Enter') open(hits[sel])
          }}
        />
        <div className="res">
          {hits.length === 0 && <p className="small muted" style={{ padding: 14 }}>Aucun résultat.</p>}
          {hits.map((h, i) => (
            <button key={i} className={cx('item', i === sel && 'on')} onMouseEnter={() => setSel(i)} onClick={() => open(h)}>
              <Icon name={h.icon} size={16} style={{ color: 'var(--ink-3)' }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="ellipsis" style={{ display: 'block', fontWeight: 600 }}>
                  {h.label}
                </span>
                <span className="xs muted">{h.detail}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Bandeau rouge, visible partout dans l'interface pendant un rendez-vous. */
export function LiveBanner() {
  const { live, data } = useApp()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!isLive(live) || !live.rdvId) return null
  const rdv = data.rdvs.find((r) => r.id === live.rdvId)
  const nom = live.brand?.nomEntreprise ?? live.prospect.nom
  const t = live.transcription
  const etat = live.simulation ? `Démonstration ×${live.simulation.speed}` : t.alerte ? t.alerte : t.status === 'actif' ? 'Son OK · transcription OK' : t.status === 'erreur' ? 'Transcription en erreur' : ''
  return (
    <div className={cx('live-banner', live.pause && 'pause')} role="status">
      <span className="row">
        <span className="dot live" style={{ background: '#fff', animation: live.pause ? 'none' : undefined }} />
        {live.phase === 'finalisation' ? `Finalisation de la maquette de ${nom}…` : live.pause ? `Rendez-vous en pause · ${nom}` : `Rendez-vous en cours avec ${nom}`}
      </span>
      <span className="tabular">{duree(now - (live.startedAt ?? now))}</span>
      <span style={{ opacity: 0.85, fontWeight: 500 }} className="ellipsis">
        {etat}
      </span>
      <span className="spacer" />
      {rdv && (
        <a className="pill" href={href({ page: 'rdv', id: rdv.id })}>
          Brief {progress(live.brief).pct} %
        </a>
      )}
      <button className="pill" onClick={() => void window.autobuild.showWidget()}>
        Réafficher la checklist
      </button>
      {live.phase === 'ecoute' && (
        <button className="pill solid" onClick={() => void window.autobuild.finishLive(true)}>
          Terminer
        </button>
      )}
    </div>
  )
}

export function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <main className={cx('page', wide && 'wide')}>{children}</main>
}

export function ProchainRelatif({ iso }: { iso: string }) {
  return <>{relatif(iso)}</>
}

export { Logo }
