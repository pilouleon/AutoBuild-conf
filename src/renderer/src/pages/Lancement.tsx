// Démarrer un rendez-vous : visio, micro et son de la visio testés en direct, accord du prospect.
// À la validation, l'interface se retire et seul le widget reste, par-dessus la visio.
import { useEffect, useState } from 'react'
import { prospectOf, useApp } from '../lib/data'
import { heure, jour } from '../lib/format'
import { href } from '../lib/router'
import { type LiveAudioState, liveAudio } from '../audio/live'
import { Icon } from '../ui/icons'
import { Meter, Modal, cx } from '../ui/kit'

export function Lancement({ rdvId, onClose }: { rdvId: string; onClose: () => void }) {
  const { data, live, settings, toast } = useApp()
  const rdv = data.rdvs.find((r) => r.id === rdvId)
  const p = rdv && prospectOf(data, rdv)
  const demo = !!rdv?.scenarioId
  const [audio, setAudio] = useState<LiveAudioState>(liveAudio.state)
  const [consent, setConsent] = useState(false)
  const [speed, setSpeed] = useState(10)
  const [briefRejoue, setBriefRejoue] = useState(true)
  const [opening, setOpening] = useState(true)
  const [error, setError] = useState<string>()
  const [starting, setStarting] = useState(false)
  const [heard, setHeard] = useState({ commercial: false, prospect: false })

  // Ouverture : préparation si besoin, preview de la maquette, test du son.
  useEffect(() => {
    let cancelled = false
    const unsub = liveAudio.subscribe((s) => {
      setAudio(s)
      setHeard((h) => ({ commercial: h.commercial || s.levels.commercial > 0.06, prospect: h.prospect || s.levels.prospect > 0.04 }))
    })
    if (!demo) void liveAudio.test(settings)
    window.autobuild
      .openLive(rdvId, demo ? speed : undefined)
      .then(() => !cancelled && setOpening(false))
      .catch((err: Error) => {
        if (cancelled) return
        setOpening(false)
        setError(err.message)
      })
    return () => {
      cancelled = true
      unsub()
    }
  }, [rdvId])

  const cancel = async () => {
    if (!starting) {
      await liveAudio.stop()
      await window.autobuild.closeLive()
    }
    onClose()
  }

  const start = async () => {
    setStarting(true)
    try {
      if (demo) {
        await window.autobuild.setSpeed(speed)
        await window.autobuild.setBriefMode(briefRejoue)
      } else {
        await window.autobuild.setConsent(true)
        liveAudio.send()
      }
      await window.autobuild.startLive()
      onClose()
    } catch (err) {
      setStarting(false)
      toast(`Démarrage impossible : ${(err as Error).message}`, true)
    }
  }

  if (!rdv) return null
  const ready = !opening && !error && live.rdvId === rdvId && live.phase === 'pret'
  const canStart = ready && (demo || consent) && !starting

  return (
    <Modal
      kicker={`${p?.nom ?? ''} · ${jour(rdv.debut).toLowerCase()} ${heure(rdv.debut)}`}
      title={demo ? 'Lancer la démonstration' : 'Démarrer le rendez-vous'}
      onClose={() => void cancel()}
      width={600}
      foot={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
          <div className="row" style={{ gap: 12, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 12, background: 'var(--soft)' }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--dark)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <span style={{ width: 12, height: 18, borderRadius: 3, background: '#4ade80', opacity: 0.85 }} />
            </span>
            <p className="small" style={{ color: 'var(--ink-2)' }}>
              AutoBuild passe en arrière-plan. Seule la <b>checklist</b> reste affichée, en petit, par-dessus votre visio. Elle n’apparaît pas si vous partagez votre écran.{' '}
              <span className="muted">Raccourci {window.autobuild.platform === 'darwin' ? '⌥ ⌘ C' : 'Ctrl Alt C'} pour revenir à l’interface.</span>
            </p>
          </div>
          <button className="btn rec lg" disabled={!canStart} onClick={() => void start()}>
            {opening ? (
              <>
                <span className="spinner" /> {rdv.statut === 'pret' ? 'Ouverture de la maquette…' : 'Préparation de la maquette…'}
              </>
            ) : starting ? (
              <>
                <span className="spinner" /> Démarrage…
              </>
            ) : (
              <>
                <span className="recdot" />
                {demo ? 'Lancer la démonstration' : 'Lancer l’enregistrement'}
              </>
            )}
          </button>
        </div>
      }
    >
      {error && (
        <p className="small" style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--err-soft)', color: 'var(--err)' }}>
          {error}
        </p>
      )}
      {demo ? (
        <ol className="stack" style={{ gap: 16 }}>
          <Etape icon="play" titre="Conversation rejouée" detail="Un faux premier rendez-vous (9 min) est rejoué : pas de micro, pas de visio." />
          <li className="stack" style={{ gap: 8 }}>
            <b>Vitesse</b>
            <div className="seg" role="group" aria-label="Vitesse">
              {[1, 5, 10, 20].map((s) => (
                <button key={s} className={cx(speed === s && 'on')} onClick={() => setSpeed(s)}>
                  ×{s}
                  {s === 1 ? ' (temps réel)' : ''}
                </button>
              ))}
            </div>
          </li>
          <li className="stack" style={{ gap: 8 }}>
            <b>Brief</b>
            <label className={cx('radio-card', briefRejoue && 'on')}>
              <input type="radio" checked={briefRejoue} onChange={() => setBriefRejoue(true)} />
              <span>
                <b style={{ display: 'block' }}>Rejoué (sans IA)</b>
                <span className="small muted">Instantané : le brief tel qu’une IA l’aurait rempli.</span>
              </span>
            </label>
            <label className={cx('radio-card', !briefRejoue && 'on')}>
              <input type="radio" checked={!briefRejoue} onChange={() => setBriefRejoue(false)} />
              <span>
                <b style={{ display: 'block' }}>Rempli par l’IA</b>
                <span className="small muted">Utilise Claude ou Gemini configuré dans les réglages, comme en vrai.</span>
              </span>
            </label>
          </li>
        </ol>
      ) : (
        <ol className="stack" style={{ gap: 18 }}>
          <Etape
            icon="video"
            titre="Rejoignez la visio"
            detail="Aucun bot ne rejoint l’appel : AutoBuild écoute votre ordinateur."
            action={
              rdv.lienVisio && (
                <button className="btn sm" onClick={() => void window.autobuild.openExternal(rdv.lienVisio!)}>
                  Ouvrir le lien
                </button>
              )
            }
          />
          <Etape
            icon="mic"
            titre="Votre micro"
            detail={
              <>
                {audio.micLabel || (audio.status === 'demarrage' ? 'Activation…' : 'Micro par défaut')} ·{' '}
                <a className="link" href={href({ page: 'reglages', section: 'son' })} onClick={() => void cancel()}>
                  changer
                </a>
              </>
            }
            action={<Niveau level={audio.levels.commercial} ok={heard.commercial} okText="On vous entend" waitText="Dites quelques mots" />}
          />
          <Etape
            icon="speaker"
            titre="Son de la visio"
            detail={audio.status === 'test' && !audio.hasProspect ? 'Non capté : voir Réglages › Micro et son' : 'Voix du prospect, captée sur l’ordinateur'}
            action={<Niveau level={audio.levels.prospect} ok={heard.prospect} okText="Son détecté" waitText="En attente de son" />}
          />
          {audio.error && (
            <p className="small" style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--err-soft)', color: 'var(--err)' }}>
              Micro inaccessible : {audio.error}
            </p>
          )}
          {audio.warnings.map((w) => (
            <p key={w} className="small" style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--warn-soft)', color: 'var(--warn)' }}>
              {w}
            </p>
          ))}
          <li>
            <label className="check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>J’ai prévenu le prospect que l’échange est transcrit pour préparer une maquette, et il est d’accord.</span>
            </label>
          </li>
        </ol>
      )}
    </Modal>
  )
}

function Etape({ icon, titre, detail, action }: { icon: string; titre: string; detail: React.ReactNode; action?: React.ReactNode }) {
  return (
    <li className="row" style={{ gap: 14, alignItems: 'center' }}>
      <span style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Icon name={icon} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: 'block' }}>{titre}</b>
        <span className="small muted">{detail}</span>
      </span>
      {action}
    </li>
  )
}

function Niveau({ level, ok, okText, waitText }: { level: number; ok: boolean; okText: string; waitText: string }) {
  return (
    <span className="row" style={{ gap: 10 }}>
      <Meter level={level} />
      <span className="xs strong" style={{ width: 112, color: ok ? 'var(--ok)' : 'var(--ink-3)' }}>
        {ok ? okText : waitText}
      </span>
    </span>
  )
}
