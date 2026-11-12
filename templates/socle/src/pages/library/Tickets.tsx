// Demandes / tickets : liste à gauche, conversation à droite, réponse et changement de statut.
import { useState } from 'react'
import { Icon } from '../../components/icons'
import { Avatar, Badge, Button, Card, Input, Modal, PageHeader, Select, cn, statusColor } from '../../components/ui'
import { formatDate } from '../../lib/format'
import { app, brand } from '../../mockup'
import { type LibraryPageProps, daysAgo, people } from './data'

interface Message {
  auteur: string
  equipe: boolean
  texte: string
  date: string
}
interface Ticket {
  id: string
  sujet: string
  categorie: string
  statut: string
  date: string
  messages: Message[]
}

function initiaux(): Ticket[] {
  const [moi] = [app.utilisateur.nom]
  const equipe = people(6).filter((p) => p !== moi)
  const t = (id: number, sujet: string, categorie: string, statut: string, j: number, q: string, rep?: string): Ticket => ({
    id: `DEM-${1200 + id}`,
    sujet,
    categorie,
    statut,
    date: daysAgo(j),
    messages: [{ auteur: moi, equipe: false, texte: q, date: daysAgo(j) }, ...(rep ? [{ auteur: equipe[id % equipe.length], equipe: true, texte: rep, date: daysAgo(Math.max(0, j - 1)) }] : [])]
  })
  return [
    t(8, 'Question sur ma dernière facture', 'Facturation', 'En cours', 1, 'Bonjour, je ne retrouve pas le détail de la ligne 3 de la facture du mois dernier. Pouvez-vous m’envoyer le justificatif ?', `Bonjour, merci pour votre message. Je regarde avec la comptabilité et je reviens vers vous dans la journée. — L’équipe ${brand.nomEntreprise}`),
    t(5, 'Demande de modification de livraison', 'Commande', 'Nouveau', 0, 'Est-il possible de décaler la livraison prévue jeudi à la semaine suivante ?'),
    t(3, 'Accès pour un nouveau collaborateur', 'Compte', 'Résolu', 6, 'Pouvez-vous créer un accès pour notre nouvelle assistante ?', 'C’est fait : elle a reçu ses identifiants par e-mail.'),
    t(1, 'Document manquant dans mon espace', 'Documents', 'Résolu', 12, 'Le certificat du mois de mars n’apparaît pas dans mes documents.', 'Le document est maintenant disponible dans « Mes documents ».')
  ]
}

export function Tickets(_: LibraryPageProps) {
  const [tickets, setTickets] = useState(initiaux)
  const [sel, setSel] = useState(tickets[0].id)
  const [reponse, setReponse] = useState('')
  const [nouveau, setNouveau] = useState(false)
  const [form, setForm] = useState({ sujet: '', categorie: 'Commande', texte: '' })
  const t = tickets.find((x) => x.id === sel) ?? tickets[0]
  const envoyer = () => {
    if (!reponse.trim()) return
    setTickets(tickets.map((x) => (x.id === t.id ? { ...x, messages: [...x.messages, { auteur: app.utilisateur.nom, equipe: false, texte: reponse, date: daysAgo(0) }] } : x)))
    setReponse('')
  }
  const creer = () => {
    if (!form.sujet.trim()) return
    const id = `DEM-${1200 + tickets.length + 10}`
    setTickets([{ id, sujet: form.sujet, categorie: form.categorie, statut: 'Nouveau', date: daysAgo(0), messages: [{ auteur: app.utilisateur.nom, equipe: false, texte: form.texte || form.sujet, date: daysAgo(0) }] }, ...tickets])
    setSel(id)
    setNouveau(false)
    setForm({ sujet: '', categorie: 'Commande', texte: '' })
  }

  return (
    <div>
      <PageHeader title="Mes demandes" subtitle={`${tickets.filter((x) => x.statut !== 'Résolu').length} demandes ouvertes`} actions={<Button icon="plus" onClick={() => setNouveau(true)}>Nouvelle demande</Button>} />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card className="overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {tickets.map((x) => (
              <li key={x.id}>
                <button onClick={() => setSel(x.id)} className={cn('w-full px-4 py-3 text-left transition', x.id === t.id ? 'bg-primary/5' : 'hover:bg-slate-50')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-slate-400">{x.id}</span>
                    <Badge color={statusColor(x.statut)}>{x.statut}</Badge>
                  </div>
                  <p className={cn('mt-1 truncate text-sm', x.id === t.id ? 'font-semibold text-primary' : 'font-medium text-slate-800')}>{x.sujet}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {x.categorie} · {formatDate(x.date)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="flex min-h-[460px] flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">{t.sujet}</p>
              <p className="text-xs text-slate-500">
                {t.id} · {t.categorie}
              </p>
            </div>
            <Badge color={statusColor(t.statut)}>{t.statut}</Badge>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {t.messages.map((m, i) => (
              <div key={i} className={cn('flex gap-3', !m.equipe && 'flex-row-reverse')}>
                <Avatar name={m.auteur} />
                <div className={cn('max-w-[75%] rounded-2xl px-4 py-2.5 text-sm', m.equipe ? 'bg-slate-100 text-slate-800' : 'bg-primary text-primary-fg')}>
                  <p>{m.texte}</p>
                  <p className={cn('mt-1 text-[11px]', m.equipe ? 'text-slate-500' : 'opacity-75')}>
                    {m.auteur} · {formatDate(m.date)}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t border-slate-100 p-4">
            <Input placeholder="Votre message…" value={reponse} onChange={(e) => setReponse(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && envoyer()} />
            <Button onClick={envoyer}>
              <Icon name="message" className="h-4 w-4" /> Envoyer
            </Button>
          </div>
        </Card>
      </div>
      <Modal
        open={nouveau}
        onClose={() => setNouveau(false)}
        title="Nouvelle demande"
        footer={
          <>
            <Button variant="outline" onClick={() => setNouveau(false)}>
              Annuler
            </Button>
            <Button onClick={creer}>Envoyer la demande</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input placeholder="Sujet" value={form.sujet} onChange={(e) => setForm({ ...form, sujet: e.target.value })} />
          <Select value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })}>
            {['Commande', 'Facturation', 'Documents', 'Compte', 'Autre'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <textarea value={form.texte} onChange={(e) => setForm({ ...form, texte: e.target.value })} rows={4} placeholder="Décrivez votre demande…" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary" />
        </div>
      </Modal>
    </div>
  )
}
