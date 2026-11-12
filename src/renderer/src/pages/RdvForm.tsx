// Nouveau rendez-vous (ou modification) : prospect, créneau, interlocuteurs, contexte, notes, template.
import { useMemo, useState } from 'react'
import type { Contact, NouveauRdvInput, Rdv, RdvContexte } from '@shared/types'
import { useApp } from '../lib/data'
import { CONTEXTES, dateCourte } from '../lib/format'
import { go } from '../lib/router'
import { Icon } from '../ui/icons'
import { Sheet } from '../ui/kit'

export interface RdvFormInit {
  prospectId?: string
  repriseDe?: string
  edit?: Rdv
}

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function localTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Créneau par défaut : le prochain quart d'heure rond, au moins dans une heure. */
function defaultSlot(): Date {
  const d = new Date(Date.now() + 60 * 60_000)
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
  return d
}

export function RdvForm({ init, onClose }: { init: RdvFormInit; onClose: () => void }) {
  const { data, templates, toast } = useApp()
  const edit = init.edit
  const prospect0 = data.prospects.find((p) => p.id === (edit?.prospectId ?? init.prospectId))
  const previous = init.repriseDe ? data.rdvs.find((r) => r.id === init.repriseDe) : undefined
  const slot = edit ? new Date(edit.debut) : defaultSlot()
  const [nom, setNom] = useState(prospect0?.nom ?? '')
  const [site, setSite] = useState(prospect0?.siteUrl ?? '')
  const [date, setDate] = useState(localDate(slot))
  const [time, setTime] = useState(localTime(slot))
  const [dureeMin, setDuree] = useState(edit?.dureeMin ?? 30)
  const [lien, setLien] = useState(edit?.lienVisio ?? '')
  const [contacts, setContacts] = useState<Contact[]>(edit?.interlocuteurs.length ? edit.interlocuteurs : prospect0?.interlocuteurs.length ? prospect0.interlocuteurs.slice(0, 2) : [{ nom: '', fonction: '' }])
  const [contexte, setContexte] = useState<RdvContexte>(edit?.contexte ?? (prospect0 ? 'client' : 'lead'))
  const [notes, setNotes] = useState(edit?.notes ?? '')
  const [template, setTemplate] = useState(edit?.templateChoisi ?? previous?.maquette.templateId ?? 'auto')
  const [busy, setBusy] = useState(false)

  // Prospect existant reconnu pendant la saisie.
  const existing = useMemo(() => {
    const n = nom.trim().toLowerCase()
    return n.length < 2 ? [] : data.prospects.filter((p) => p.nom.toLowerCase().includes(n) && p.id !== prospect0?.id).slice(0, 3)
  }, [nom, data.prospects, prospect0])
  const exact = data.prospects.find((p) => p.nom.trim().toLowerCase() === nom.trim().toLowerCase())

  const submit = async () => {
    if (!nom.trim()) return toast('Indiquez le nom de l’entreprise.', true)
    const debut = new Date(`${date}T${time || '09:00'}`)
    if (Number.isNaN(debut.getTime())) return toast('Date ou heure invalide.', true)
    setBusy(true)
    try {
      const interlocuteurs = contacts.filter((c) => c.nom.trim())
      if (edit) {
        await window.autobuild.updateRdv(edit.id, { debut: debut.toISOString(), dureeMin, lienVisio: lien || undefined, contexte, notes, interlocuteurs, templateChoisi: template })
        const siteUrl = normalizeUrl(site) || undefined
        await window.autobuild.updateProspect(edit.prospectId, { nom: nom.trim(), siteUrl })
        // Nouveau site : l'identité visuelle et la maquette de départ sont refaites.
        if (siteUrl !== prospect0?.siteUrl && edit.statut !== 'termine') void window.autobuild.prepareRdv(edit.id).catch(() => {})
        toast('Rendez-vous modifié.')
        onClose()
        return
      }
      const input: NouveauRdvInput = { prospectId: exact?.id ?? prospect0?.id, prospectNom: nom.trim(), siteUrl: normalizeUrl(site), debut: debut.toISOString(), dureeMin, lienVisio: lien.trim() || undefined, contexte, notes, interlocuteurs, templateChoisi: template, repriseDe: init.repriseDe }
      const rdv = await window.autobuild.createRdv(input)
      onClose()
      go({ page: 'rdv', id: rdv.id })
    } catch (err) {
      toast((err as Error).message, true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      title={edit ? 'Modifier le rendez-vous' : previous ? 'Planifier le rendez-vous suivant' : 'Nouveau rendez-vous'}
      subtitle={edit ? 'Changer le template refait la maquette de départ.' : previous ? `La maquette et le brief du ${dateCourte(previous.debut)} sont repris.` : 'La préparation démarre dès l’enregistrement.'}
      onClose={onClose}
      foot={
        <>
          <button className="btn ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn primary" disabled={busy} onClick={() => void submit()}>
            {edit ? 'Enregistrer' : 'Créer et préparer'}
          </button>
        </>
      }
    >
      <fieldset>
        <legend>Prospect</legend>
        <label className="field">
          Entreprise
          <input className="input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom de l’entreprise" autoFocus={!edit} disabled={!!previous} />
        </label>
        {!edit && !previous && existing.length > 0 && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
            {existing.map((p) => (
              <button
                key={p.id}
                className="rowlink"
                style={{ padding: '10px 12px' }}
                onClick={() => {
                  setNom(p.nom)
                  setSite(p.siteUrl ?? '')
                  if (p.interlocuteurs.length) setContacts(p.interlocuteurs.slice(0, 2))
                  setContexte('client')
                }}
              >
                <Icon name="building" size={16} style={{ color: 'var(--ink-3)' }} />
                <span style={{ flex: 1 }}>
                  <b>{p.nom}</b> <span className="muted small">· prospect existant</span>
                </span>
                <span className="xs muted">{data.rdvs.filter((r) => r.prospectId === p.id).length} RDV</span>
              </button>
            ))}
          </div>
        )}
        <label className="field">
          Site web
          <input className="input" value={site} onChange={(e) => setSite(e.target.value)} placeholder="www.entreprise.fr" />
          <span className="hint">Logo, couleurs, police et textes sont récupérés pour habiller la maquette.</span>
        </label>
      </fieldset>
      <fieldset>
        <legend>Créneau</legend>
        <div className="grid3">
          <label className="field">
            Date
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            Heure
            <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <label className="field">
            Durée
            <select className="input" value={dureeMin} onChange={(e) => setDuree(Number(e.target.value))}>
              {[20, 30, 45, 60, 90].map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? `${m} min` : m === 60 ? '1 h' : '1 h 30'}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">
          Lien de la visio (facultatif)
          <input className="input" value={lien} onChange={(e) => setLien(e.target.value)} placeholder="Collez le lien Teams, Meet ou Zoom" />
        </label>
      </fieldset>
      <fieldset>
        <legend>Interlocuteurs</legend>
        {contacts.map((c, i) => (
          <div key={i} className="row" style={{ alignItems: 'flex-end' }}>
            <label className="field" style={{ flex: 1 }}>
              {i === 0 && 'Nom'}
              <input className="input" value={c.nom} onChange={(e) => setContacts(contacts.map((x, j) => (j === i ? { ...x, nom: e.target.value } : x)))} placeholder="Prénom Nom" />
            </label>
            <label className="field" style={{ flex: 1 }}>
              {i === 0 && 'Fonction'}
              <input className="input" value={c.fonction ?? ''} onChange={(e) => setContacts(contacts.map((x, j) => (j === i ? { ...x, fonction: e.target.value } : x)))} placeholder="Directrice financière" />
            </label>
            {contacts.length > 1 && (
              <button className="iconbtn" aria-label="Retirer" onClick={() => setContacts(contacts.filter((_, j) => j !== i))}>
                <Icon name="x" size={16} />
              </button>
            )}
          </div>
        ))}
        <button className="link" style={{ alignSelf: 'flex-start' }} onClick={() => setContacts([...contacts, { nom: '', fonction: '' }])}>
          + Ajouter un interlocuteur
        </button>
      </fieldset>
      <fieldset>
        <legend>Contexte</legend>
        <div className="chips" role="radiogroup" aria-label="Contexte">
          {(Object.keys(CONTEXTES) as RdvContexte[]).map((k) => (
            <button key={k} role="radio" aria-checked={contexte === k} className={`chip${contexte === k ? ' on' : ''}`} onClick={() => setContexte(k)}>
              {CONTEXTES[k]}
            </button>
          ))}
        </div>
        <label className="field">
          Notes pour l’IA
          <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ce que vous savez déjà : besoin évoqué, cahier des charges, concurrents…" />
          <span className="hint">Utilisées pour choisir le template de départ, jamais comme information du brief.</span>
        </label>
        <label className="field">
          Template de départ
          <select className="input" value={template} onChange={(e) => setTemplate(e.target.value)}>
            <option value="auto">Automatique : choisi d’après le besoin, ajusté pendant l’appel</option>
            {templates
              .filter((t) => t.ready)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.source === 'agence' ? ' (agence)' : ''}
                </option>
              ))}
          </select>
        </label>
      </fieldset>
    </Sheet>
  )
}

function normalizeUrl(s: string): string {
  const v = s.trim()
  if (!v) return ''
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}
