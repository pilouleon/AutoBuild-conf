// Utilisateurs et droits : matrice rôles × modules (lecture / modification) et liste des utilisateurs.
import { useState } from 'react'
import { Icon } from '../../components/icons'
import { Avatar, Badge, Button, Card, CardHeader, PageHeader, Tabs, cn } from '../../components/ui'
import { app } from '../../mockup'
import { type LibraryPageProps, daysAgo, email, people, rng } from './data'
import { formatDate } from '../../lib/format'

type Niveau = 'aucun' | 'lecture' | 'modification'
const ORDRE: Niveau[] = ['aucun', 'lecture', 'modification']

export function Droits(_: LibraryPageProps) {
  const roles = app.roles.length ? app.roles : [{ id: 'admin', label: 'Administrateur' }]
  const modules = app.navigation.filter((n) => n.cible !== 'droits')
  const [matrice, setMatrice] = useState<Record<string, Niveau>>(() => {
    const m: Record<string, Niveau> = {}
    roles.forEach((r, ri) =>
      modules.forEach((n) => {
        const visible = !n.roles || n.roles.includes(r.id)
        m[`${r.id}:${n.id}`] = !visible ? 'aucun' : ri === 0 ? 'modification' : n.type === 'tableau-de-bord' ? 'lecture' : 'modification'
      })
    )
    return m
  })
  const [onglet, setOnglet] = useState<'roles' | 'utilisateurs'>('roles')
  const users = people(8)
  const r = rng('droits')

  return (
    <div>
      <PageHeader title="Utilisateurs et droits" subtitle={`${roles.length} rôles · ${users.length} utilisateurs`} actions={<Tabs value={onglet} onChange={setOnglet} options={[{ value: 'roles', label: 'Rôles', icon: 'shield' }, { value: 'utilisateurs', label: 'Utilisateurs', icon: 'users' }]} />} />
      {onglet === 'roles' ? (
        <Card>
          <CardHeader title="Droits par rôle" subtitle="Cliquez sur une case pour changer le niveau d’accès." />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                  <th className="px-5 py-3 font-medium">Module</th>
                  {roles.map((ro) => (
                    <th key={ro.id} className="px-3 py-3 text-center font-medium">
                      {ro.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((n) => (
                  <tr key={n.id} className="border-b border-slate-50">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2 font-medium text-slate-800">
                        <Icon name={n.icone} className="h-4 w-4 text-slate-400" /> {n.label}
                      </span>
                    </td>
                    {roles.map((ro) => {
                      const k = `${ro.id}:${n.id}`
                      const v = matrice[k]
                      return (
                        <td key={ro.id} className="px-3 py-2 text-center">
                          <button
                            onClick={() => setMatrice({ ...matrice, [k]: ORDRE[(ORDRE.indexOf(v) + 1) % 3] })}
                            className={cn(
                              'inline-flex min-w-[110px] items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition',
                              v === 'modification' ? 'bg-primary/10 text-primary' : v === 'lecture' ? 'bg-slate-100 text-slate-600' : 'text-slate-300 hover:bg-slate-50'
                            )}
                          >
                            <Icon name={v === 'aucun' ? 'x' : v === 'lecture' ? 'search' : 'check'} className="h-3.5 w-3.5" />
                            {v === 'aucun' ? 'Aucun accès' : v === 'lecture' ? 'Lecture' : 'Modification'}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader title="Utilisateurs" action={<Button icon="plus">Inviter</Button>} />
          <ul className="divide-y divide-slate-100">
            {users.map((u, i) => {
              const role = roles[i === 0 ? 0 : Math.floor(r() * roles.length)]
              return (
                <li key={u} className="flex items-center gap-3 px-5 py-3">
                  <Avatar name={u} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{u}</p>
                    <p className="truncate text-xs text-slate-500">{email(u)}</p>
                  </div>
                  <Badge color="marque">{role.label}</Badge>
                  <span className="hidden w-40 text-right text-xs text-slate-500 md:block">Dernière connexion {formatDate(daysAgo(Math.floor(r() * 9)))}</span>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
