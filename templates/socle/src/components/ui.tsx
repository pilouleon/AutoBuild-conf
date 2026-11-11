// Composants d'interface (style proche de shadcn/ui, sans dépendance).
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { Icon } from './icons'

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline'

export function Button({ variant = 'primary', icon, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: string }) {
  const styles: Record<Variant, string> = {
    primary: 'bg-primary text-primary-fg hover:opacity-90 shadow-sm',
    secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200',
    ghost: 'text-slate-600 hover:bg-slate-100',
    outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
  }
  return (
    <button className={cn('inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-50', styles[variant], className)} {...rest}>
      {icon && <Icon name={icon} className="h-4 w-4" />}
      {children}
    </button>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>{children}</div>
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

const BADGE_COLORS: Record<string, string> = {
  vert: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  orange: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  rouge: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  bleu: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  gris: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  marque: 'bg-primary/10 text-primary ring-primary/20'
}

export function Badge({ color = 'gris', children }: { color?: string; children: ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', BADGE_COLORS[color] ?? BADGE_COLORS.gris)}>{children}</span>
}

/** Couleur automatique d'un statut s'il n'y en a pas de définie. */
export function statusColor(value: string, explicit?: Record<string, string>): string {
  if (explicit?.[value]) return explicit[value]
  const v = value.toLowerCase()
  if (/(retard|annul|bloqu|refus|perdu|impay|urgent|critique|rupture|dérive|derive)/.test(v)) return 'rouge'
  if (/(attente|valider|en validation|brouillon|envoy|prévu|planifi|à faire|à traiter|nouveau|maintenance|faible|saisi|démarrer|demarrer)/.test(v)) return 'orange'
  if (/(termin|valid|pay|livr|clos|actif|ok|gagn|sign|réalis|réception|reception|disponible|en stock|transmis|export|résolu|resolu|confirm|publi)/.test(v)) return 'vert'
  if (/(cours|ouvert|démarr|traitement|affect|mission|expédi|expedi|négociation|proposition)/.test(v)) return 'bleu'
  return 'gris'
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 placeholder:text-slate-400 focus:border-primary focus:ring-4', className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn('w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:border-primary focus:ring-4', className)} {...rest}>
      {children}
    </select>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-xs font-medium text-slate-600">{children}</label>
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: string }[] }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition', value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}
        >
          {o.icon && <Icon name={o.icon} className="h-3.5 w-3.5" />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">{footer}</div>}
      </div>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Avatar({ name, size = 'h-8 w-8' }: { name: string; size?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
  return <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary', size)}>{initials}</span>
}

export function EmptyState({ icon = 'folder', title, text }: { icon?: string; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {text && <p className="mt-1 text-sm text-slate-500">{text}</p>}
    </div>
  )
}
