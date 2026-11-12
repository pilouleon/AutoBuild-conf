// Composants d'interface partagés.
import { type ReactNode, useEffect } from 'react'
import type { Brand, Rdv } from '@shared/types'
import { STATUTS, initiales } from '../lib/format'
import { Icon } from './icons'

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ')
}

export function StatutBadge({ rdv, preparing }: { rdv: Rdv; preparing?: boolean }) {
  const s = STATUTS[preparing ? 'preparation' : rdv.statut]
  return (
    <span className={`badge ${s.tone}`}>
      {rdv.statut === 'en_cours' && <span className="dot rec live" />}
      {s.label}
    </span>
  )
}

/** Logo du prospect (logo du site, sinon initiales sur sa couleur). */
export function Logo({ nom, brand, size = 40, radius }: { nom: string; brand?: Brand; size?: number; radius?: number }) {
  const style = { width: size, height: size, borderRadius: radius ?? Math.round(size / 4.2), fontSize: Math.max(11, Math.round(size / 3)) }
  if (brand?.logoDataUrl)
    return (
      <span className="logo-tile" style={{ ...style, border: '1px solid var(--line)' }}>
        <img src={brand.logoDataUrl} alt={`Logo ${nom}`} />
      </span>
    )
  const c = brand?.couleurs.primaire
  return (
    <span className="logo-tile" style={{ ...style, ...(c ? { background: c, color: '#fff' } : {}) }}>
      {initiales(nom)}
    </span>
  )
}

export function Avatar({ nom, size = 32 }: { nom: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size / 2.7) }}>
      {initiales(nom)}
    </span>
  )
}

export function Progress({ pct, tone = 'ok', height = 6 }: { pct: number; tone?: 'ok' | 'indigo'; height?: number }) {
  return (
    <div className={cx('progress', tone === 'indigo' && 'indigo')} style={{ height }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}

export function Card({ title, action, children, className, foot, bodyClass }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; foot?: ReactNode; bodyClass?: string }) {
  return (
    <section className={cx('card', className)}>
      {title && (
        <div className="card-head">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
      {foot && <div className="card-foot">{foot}</div>}
    </section>
  )
}

export function Modal({ title, kicker, onClose, children, foot, width = 560 }: { title: string; kicker?: string; onClose: () => void; children: ReactNode; foot?: ReactNode; width?: number }) {
  useEscape(onClose)
  return (
    <div className="overlay center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title} style={{ width }}>
        <div className="modal-head">
          <div>
            {kicker && <p className="small muted">{kicker}</p>}
            <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: kicker ? 2 : 0 }}>{title}</h1>
          </div>
          <button className="iconbtn" aria-label="Fermer" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  )
}

export function Sheet({ title, subtitle, onClose, children, foot }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; foot?: ReactNode }) {
  useEscape(onClose)
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="sheet" role="dialog" aria-label={title}>
        <div className="sheet-head">
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700 }}>{title}</h1>
            {subtitle && <p className="small muted" style={{ marginTop: 4 }}>{subtitle}</p>}
          </div>
          <button className="iconbtn" aria-label="Fermer" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        <div className="sheet-body" style={{ flex: 1 }}>
          {children}
        </div>
        {foot && <div className="sheet-foot">{foot}</div>}
      </section>
    </div>
  )
}

export function useEscape(fn: () => void): void {
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && fn()
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [fn])
}

export function Empty({ icon = 'sparkle', title, text, children }: { icon?: string; title: string; text?: ReactNode; children?: ReactNode }) {
  return (
    <div className="empty">
      <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--soft)', display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
        <Icon name={icon} size={22} />
      </span>
      <b>{title}</b>
      {text && <p className="small" style={{ maxWidth: 420 }}>{text}</p>}
      {children}
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} className={cx(o.value === value && 'on')} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function StepIcon({ etat }: { etat: 'fait' | 'en_cours' | 'a_venir' | 'echec' | 'sans_objet' | 'attente' | 'ok' }) {
  const e = etat === 'ok' ? 'fait' : etat === 'attente' ? 'a_venir' : etat
  return (
    <span className={cx('step-icon', e)}>
      {e === 'fait' && <Icon name="check" size={14} stroke={2.6} />}
      {e === 'echec' && <Icon name="x" size={14} stroke={2.6} />}
      {e === 'en_cours' && <span className="spinner" style={{ color: 'var(--accent)', width: 10, height: 10, borderWidth: 2 }} />}
    </span>
  )
}

/** Niveau audio en barres (0 à 1). */
export function Meter({ level }: { level: number }) {
  const bars = [0.08, 0.16, 0.28, 0.42, 0.58, 0.75]
  return (
    <span className="meter" aria-hidden="true">
      {bars.map((b, i) => (
        <span key={i} className={cx(level >= b && 'on')} style={{ height: 6 + i * 3 }} />
      ))}
    </span>
  )
}
