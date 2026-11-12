// Mise en page : barre latérale aux couleurs de la marque + en-tête avec sélecteur de rôle.
import type { ReactNode } from 'react'
import { agence, app, brand } from '../mockup'
import { Link } from '../lib/router'
import { Icon } from './icons'
import { Avatar, cn } from './ui'

export function BrandMark({ size = 'h-9' }: { size?: string }) {
  if (brand.logo) return <img src={brand.logo} alt={brand.nomEntreprise} className={cn(size, 'w-auto max-w-[160px] object-contain')} />
  return (
    <span className={cn('inline-flex aspect-square items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-fg', size)}>
      {brand.nomEntreprise.slice(0, 2).toUpperCase()}
    </span>
  )
}

type LayoutProps = { active: string; role: string; onRole: (r: string) => void; onLogout: () => void; children: ReactNode }

export function Layout(props: LayoutProps) {
  return app.layout === 'topnav' ? <TopnavLayout {...props} /> : <SidebarLayout {...props} />
}

function UserMenu({ role, onRole, onLogout }: Pick<LayoutProps, 'role' | 'onRole' | 'onLogout'>) {
  return (
    <div className="flex items-center gap-3">
      {app.roles.length > 1 && (
        <select value={role} onChange={(e) => onRole(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600">
          {app.roles.map((r) => (
            <option key={r.id} value={r.id}>
              Vue : {r.label}
            </option>
          ))}
        </select>
      )}
      <button className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
        <Icon name="bell" className="h-5 w-5" />
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
      </button>
      <div className="flex items-center gap-2.5">
        <Avatar name={app.utilisateur.nom} />
        <div className="hidden text-right leading-tight lg:block">
          <p className="text-sm font-medium text-slate-900">{app.utilisateur.nom}</p>
          <p className="text-xs text-slate-500">{app.roles.find((r) => r.id === role)?.label ?? app.utilisateur.poste}</p>
        </div>
      </div>
      <button onClick={onLogout} title="Déconnexion" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
        <Icon name="logout" className="h-[18px] w-[18px]" />
      </button>
    </div>
  )
}

/** Portail, intranet, extranet : menu horizontal sous l'en-tête, contenu centré. */
function TopnavLayout({ active, role, onRole, onLogout, children }: LayoutProps) {
  const items = app.navigation.filter((n) => !n.roles || n.roles.includes(role))
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-brand text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-6">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark size="h-8" />
            <div className="min-w-0 leading-tight">
              {!brand.logo && <p className="truncate text-sm font-semibold text-slate-900">{brand.nomEntreprise}</p>}
              <p className="truncate text-xs font-medium text-slate-500">{app.titre}</p>
            </div>
          </div>
          <UserMenu role={role} onRole={onRole} onLogout={onLogout} />
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
          {items.map((item) => (
            <Link
              key={item.id}
              to={item.id}
              className={cn(
                'flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition',
                active === item.id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
              )}
            >
              <Icon name={item.icone} className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-[11px] text-slate-400">
        {brand.nomEntreprise} · {agence.nom} · {agence.mention}
      </footer>
    </div>
  )
}

function SidebarLayout({ active, role, onRole, onLogout, children }: LayoutProps) {
  const items = app.navigation.filter((n) => !n.roles || n.roles.includes(role))
  const sections = [...new Set(items.map((i) => i.section ?? ''))]
  return (
    <div className="flex h-screen bg-slate-50 font-brand text-slate-800">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <BrandMark size="h-8" />
            {!brand.logo && <p className="truncate text-sm font-semibold text-slate-900">{brand.nomEntreprise}</p>}
          </div>
          <p className="mt-2 truncate text-xs font-medium uppercase tracking-wider text-slate-400">{app.titre}</p>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section || 'main'} className="mb-4">
              {section && <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{section}</p>}
              {items
                .filter((i) => (i.section ?? '') === section)
                .map((item) => (
                  <Link
                    key={item.id}
                    to={item.id}
                    className={cn(
                      'mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                      active === item.id ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    )}
                  >
                    <Icon name={item.icone} className="h-[18px] w-[18px]" />
                    {item.label}
                  </Link>
                ))}
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-100 px-5 py-3 text-[11px] leading-snug text-slate-400">
          {agence.nom} · {agence.mention}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-8">
          <div className="relative w-full max-w-md">
            <Icon name="search" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input placeholder="Rechercher…" className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary focus:bg-white" />
          </div>
          <UserMenu role={role} onRole={onRole} onLogout={onLogout} />
        </header>
        <main className="flex-1 overflow-y-auto px-8 py-7">{children}</main>
      </div>
    </div>
  )
}
