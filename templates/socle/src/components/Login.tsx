// Écran de connexion à l'image du prospect (premier écran montré en démo).
import { agence, app, brand } from '../mockup'
import { BrandMark } from './Layout'
import { Button, Input, Label } from './ui'

function emailDomain(): string {
  const url = brand.url ?? ''
  if (/^https?:\/\//.test(url)) return url.replace(/^https?:\/\/(www\.)?/, '').replace(/[/:].*$/, '')
  return `${brand.nomEntreprise.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')}.fr`
}

export function Login({ onLogin }: { onLogin: () => void }) {
  const prenom = (app.utilisateur.nom.split(' ')[0] ?? 'prenom').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return (
    <div className="grid min-h-screen font-brand lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-secondary p-12 text-secondary-fg lg:flex">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary opacity-30 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-accent opacity-20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="rounded-xl bg-white p-2 shadow-sm">
            <BrandMark size="h-10" />
          </span>
          {!brand.logo && <span className="text-lg font-semibold">{brand.nomEntreprise}</span>}
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold leading-tight">{app.titre}</h1>
          <p className="mt-4 text-base opacity-80">{brand.slogan || app.sousTitre}</p>
        </div>
        <p className="relative text-xs opacity-60">
          {agence.nom} — {agence.mention}
        </p>
      </div>
      <div className="flex items-center justify-center bg-white p-8">
        <form
          noValidate
          className="w-full max-w-sm"
          onSubmit={(e) => {
            e.preventDefault()
            onLogin()
          }}
        >
          <div className="mb-8 lg:hidden">
            <BrandMark size="h-10" />
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">Connexion</h2>
          <p className="mt-1 text-sm text-slate-500">Accédez à votre espace {brand.nomEntreprise}</p>
          <div className="mt-8 space-y-4">
            <div>
              <Label>Adresse e-mail</Label>
              <Input type="email" defaultValue={`${prenom}@${emailDomain()}`} />
            </div>
            <div>
              <Label>Mot de passe</Label>
              <Input type="password" defaultValue="maquette" />
            </div>
            <Button type="submit" className="w-full py-2.5">
              Se connecter
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
