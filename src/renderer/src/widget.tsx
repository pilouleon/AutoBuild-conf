// Widget du rendez-vous : petite fenêtre (≈ 1/5 de l'écran) toujours par-dessus la visio, invisible en partage d'écran.
// Infos obtenues en vert en haut, infos à obtenir en gris en bas (la liste est ancrée en bas : le manquant reste visible).
import { StrictMode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { checklist, progress } from '@shared/brief/schema'
import { maquetteProgress } from '@shared/mockup/progress'
import type { SessionState } from '@shared/types'
import { useSessionState } from './lib/data'
import { duree } from './lib/format'
import { Icon } from './ui/icons'
import './widget.css'

const NOUVEAU_MS = 3 * 60_000

function useNow(): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

function Widget() {
  const s = useSessionState()
  const [mode, setMode] = useState<'ouvert' | 'reduit'>('ouvert')
  const [confirm, setConfirm] = useState(false)
  const now = useNow()
  useEffect(() => {
    void window.autobuild.getWidgetMode().then(setMode)
    return window.autobuild.onWidgetMode(setMode)
  }, [])
  if (!s) return null
  const nom = s.brand?.nomEntreprise ?? s.prospect.nom
  const pct = progress(s.brief).pct
  const mq = maquetteProgress(s.generation, s.brief, s.phase)
  const temps = duree(now - (s.startedAt ?? now))
  const reduire = () => void window.autobuild.setWidgetMode(mode === 'ouvert' ? 'reduit' : 'ouvert')

  if (mode === 'reduit')
    return (
      <div className="pill drag" role="status">
        <span className={`rec${s.pause ? ' paused' : ''}`} />
        <span className="time">{temps}</span>
        <span className="g">Brief {pct} %</span>
        <span className="i">Maquette {mq.pct} %</span>
        {s.transcription.alerte && <Icon name="alert" size={15} style={{ color: '#fbbf24' }} />}
        <span className="grow" />
        <button className="round nodrag" aria-label="Déplier la checklist" onClick={reduire}>
          <Icon name="expand" size={14} />
        </button>
      </div>
    )

  return (
    <section className="panel" aria-label="Checklist du rendez-vous">
      <header className="head drag">
        <Icon name="drag" size={14} style={{ color: '#6b7280' }} />
        <span className={`rec${s.pause ? ' paused' : ''}`} />
        <span className="time">{temps}</span>
        <span className="name">{nom}</span>
        {s.simulation && <span className="demo">Démo ×{s.simulation.speed}</span>}
        <span className="grow" />
        <button className="ib nodrag" aria-label="Réduire en pastille" title="Réduire" onClick={reduire}>
          <Icon name="minimize" size={15} />
        </button>
        <button className="ib nodrag" aria-label="Revenir à l’interface AutoBuild" title="Interface AutoBuild" onClick={() => void window.autobuild.showMain()}>
          <Icon name="window" size={15} />
        </button>
        <button className="ib nodrag" aria-label="Fermer la checklist (l’enregistrement continue)" title="Fermer (l’enregistrement continue)" onClick={() => void window.autobuild.hideWidget()}>
          <Icon name="x" size={15} />
        </button>
      </header>

      <div className="bars">
        <div>
          <div className="lbl">
            <span>Brief</span>
            <span className="g">{pct} %</span>
          </div>
          <div className="track">
            <div className="fill g" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div>
          <div className="lbl">
            <span>Maquette</span>
            <span className="i">{mq.pct} %</span>
          </div>
          <div className="track">
            <div className="fill i" style={{ width: `${mq.pct}%` }} />
          </div>
          <p className="sub">{maquetteLigne(s, mq)}</p>
        </div>
      </div>

      {s.transcription.alerte && !confirm && (
        <div className="alert" role="alert">
          <b>{s.transcription.alerte.split(' : ')[0]}</b>
          {s.transcription.alerte.includes(' : ') ? s.transcription.alerte.split(' : ').slice(1).join(' : ') : ''}
        </div>
      )}
      {s.pause && !confirm && <div className="alert pause">Écoute en pause : ce qui est dit n’est pas transcrit.</div>}

      {s.phase === 'finalisation' ? (
        <div className="final">
          <span className="spin" />
          <p className="big">Finalisation de la maquette…</p>
          <p className="muted">Elle s’ouvrira en plein écran dans un instant, prête à être partagée.</p>
        </div>
      ) : confirm ? (
        <Confirm s={s} onCancel={() => setConfirm(false)} />
      ) : (
        <Liste s={s} now={now} />
      )}

      {!confirm && s.phase === 'ecoute' && (
        <footer className="foot">
          <button className="btn ghost" onClick={() => void window.autobuild.pauseLive(!s.pause)}>
            <Icon name={s.pause ? 'play' : 'pause'} size={14} />
            {s.pause ? 'Reprendre' : 'Pause'}
          </button>
          <button className="btn red" onClick={() => setConfirm(true)}>
            Terminer
          </button>
        </footer>
      )}
    </section>
  )
}

function maquetteLigne(s: SessionState, mq: ReturnType<typeof maquetteProgress>): string {
  const g = s.generation
  if (g.status === 'erreur') return 'Problème de maquette : la version sûre est conservée'
  const i = mq.courante ? mq.etapes.indexOf(mq.courante) + 1 : mq.etapes.length
  const actives = mq.etapes.filter((e) => e.etat !== 'sans_objet').length
  if (!mq.courante) return 'Maquette prête'
  if (mq.courante.id === 'finition' && s.phase === 'ecoute') return `À jour avec le brief · finition à la fin du rendez-vous${g.templateName ? ` · ${g.templateName}` : ''}`
  return `Étape ${Math.min(i, actives)} sur ${actives} · ${g.activity ? g.activity : mq.courante.label.toLowerCase()}${g.templateName ? ` · ${g.templateName}` : ''}`
}

function Liste({ s, now }: { s: SessionState; now: number }) {
  const { obtenus, manquants } = checklist(s.brief)
  const box = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  // Ancrée en bas : on reste en bas de liste (là où sont les infos à obtenir), sauf si l'utilisateur remonte.
  useLayoutEffect(() => {
    const el = box.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  })
  return (
    <div
      className="list"
      ref={box}
      onScroll={(e) => {
        const el = e.currentTarget
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
      }}
    >
      <div className="inner">
        <p className="sec g">Obtenu · {obtenus.length}</p>
        {obtenus.length === 0 && <p className="empty">Les infos apparaissent ici au fil de l’échange.</p>}
        {obtenus.map((o, i) => (
          <div key={o.id} className={`ok${o.origine === 'ia' ? ' ia' : ''}`} style={{ opacity: 0.5 + (0.5 * (i + 1)) / obtenus.length }}>
            <span className="bullet">●</span>
            <span>
              <span className="l">{o.label} :</span> <span className="v">{o.valeur ?? (o.status === 'partiel' ? 'en partie' : '')}</span>
              {o.origine === 'ia' && <span className="tag">ajouté par l’IA</span>}
            </span>
          </div>
        ))}
        <div className="sep" />
        <p className="sec">À obtenir · {manquants.length}</p>
        {manquants.map((m) => (
          <div key={m.id} className={`todo${m.cle ? ' key' : ''}`}>
            <span className="circle" />
            <span className="grow">{m.label}</span>
            {m.origine !== 'grille' && now - m.majLe < NOUVEAU_MS && <span className="new">nouveau</span>}
          </div>
        ))}
        {manquants.length === 0 && <p className="empty">Tout est obtenu. 🎉</p>}
      </div>
    </div>
  )
}

function Confirm({ s, onCancel }: { s: SessionState; onCancel: () => void }) {
  const [busy, setBusy] = useState(false)
  const cles = checklist(s.brief).manquants.filter((m) => m.cle)
  return (
    <div className="final">
      <p className="big">Terminer le rendez-vous ?</p>
      <p className="muted">L’enregistrement s’arrête, la maquette est finalisée (environ 1 min), puis elle s’ouvre en plein écran pour la partager.</p>
      {cles.length > 0 && <p className="hint">Encore à obtenir : {cles.map((c) => c.label.toLowerCase()).join(', ')}.</p>}
      <button
        className="btn light"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          void window.autobuild.finishLive(true)
        }}
      >
        {busy ? 'Finalisation…' : 'Terminer et montrer la maquette'}
      </button>
      <button className="btn ghost" disabled={busy} onClick={onCancel}>
        Continuer l’écoute
      </button>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Widget />
  </StrictMode>
)
