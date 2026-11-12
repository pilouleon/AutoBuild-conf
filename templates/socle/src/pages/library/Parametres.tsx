// Paramètres (ou « Mon compte » sur un portail) : fiche société, numérotation, préférences de notification.
import { useState } from 'react'
import { BrandMark } from '../../components/Layout'
import { Button, Card, CardHeader, Input, Label, PageHeader, Tabs, cn } from '../../components/ui'
import { app, brand } from '../../mockup'
import { type LibraryPageProps, email, telephone, rng } from './data'

export function Parametres(_: LibraryPageProps) {
  const portail = app.layout === 'topnav'
  const [onglet, setOnglet] = useState<'general' | 'notifications'>('general')
  const [saved, setSaved] = useState(false)
  const r = rng('parametres')
  const [notifs, setNotifs] = useState<Record<string, boolean>>({ 'Nouvel élément qui me concerne': true, 'Changement de statut': true, 'Résumé hebdomadaire par e-mail': false, 'Rappels d’échéance': true })
  return (
    <div className="max-w-4xl">
      <PageHeader
        title={portail ? 'Mon compte' : 'Paramètres'}
        subtitle={portail ? 'Vos informations et vos préférences.' : `Configuration de l’application ${app.titre}.`}
        actions={<Tabs value={onglet} onChange={setOnglet} options={[{ value: 'general', label: portail ? 'Profil' : 'Général' }, { value: 'notifications', label: 'Notifications' }]} />}
      />
      {onglet === 'general' ? (
        <div className="space-y-6">
          <Card>
            <CardHeader title={portail ? 'Mes informations' : 'Société'} />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {!portail && (
                <div className="flex items-center gap-4 sm:col-span-2">
                  <BrandMark size="h-12" />
                  <Button variant="outline">Changer le logo</Button>
                </div>
              )}
              <div>
                <Label>{portail ? 'Nom' : 'Raison sociale'}</Label>
                <Input defaultValue={portail ? app.utilisateur.nom : brand.nomEntreprise} />
              </div>
              <div>
                <Label>E-mail</Label>
                <Input defaultValue={portail ? email(app.utilisateur.nom) : email('contact')} />
              </div>
              <div>
                <Label>Téléphone</Label>
                <Input defaultValue={telephone(r)} />
              </div>
              <div>
                <Label>{portail ? 'Fonction' : 'Site web'}</Label>
                <Input defaultValue={portail ? app.utilisateur.poste : brand.url ?? ''} />
              </div>
            </div>
          </Card>
          {!portail && (
            <Card>
              <CardHeader title="Numérotation" subtitle="Format des numéros attribués automatiquement." />
              <div className="grid gap-4 p-5 sm:grid-cols-3">
                {app.entites.slice(0, 3).map((e, i) => (
                  <div key={e.id}>
                    <Label>{e.labelPluriel}</Label>
                    <Input defaultValue={`${e.label.slice(0, 2).toUpperCase()}-{AAAA}-{${'0'.repeat(4 - (i % 2))}}`} />
                  </div>
                ))}
              </div>
            </Card>
          )}
          <div className="flex justify-end gap-3">
            {saved && <span className="self-center text-sm text-emerald-600">Modifications enregistrées</span>}
            <Button onClick={() => setSaved(true)}>Enregistrer</Button>
          </div>
        </div>
      ) : (
        <Card>
          <CardHeader title="Notifications" />
          <ul className="divide-y divide-slate-100">
            {Object.entries(notifs).map(([k, v]) => (
              <li key={k} className="flex items-center justify-between px-5 py-4">
                <span className="text-sm text-slate-700">{k}</span>
                <button onClick={() => setNotifs({ ...notifs, [k]: !v })} className={cn('relative h-6 w-11 rounded-full transition', v ? 'bg-primary' : 'bg-slate-200')} aria-pressed={v}>
                  <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', v ? 'left-[22px]' : 'left-0.5')} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
