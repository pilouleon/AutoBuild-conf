// Colonne centrale : contrôle de l'écoute et transcription en direct.
import { useEffect, useRef, useState } from 'react'
import { formatTime } from '@shared/brief/prompt'
import type { SessionState, Settings } from '@shared/types'
import { AudioCapture } from '../audio/capture'
import { useElapsed } from '../hooks'

export function TranscriptPanel({ state, settings }: { state: SessionState; settings: Settings }) {
  const capture = useRef<AudioCapture>(undefined)
  const bottom = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [warning, setWarning] = useState<string>()
  const listening = state.phase === 'ecoute'
  const simulation = !!state.simulation
  const elapsed = useElapsed(listening ? state.startedAt : undefined)

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [state.transcript.length, state.interim.prospect, state.interim.commercial])

  const start = async () => {
    setBusy(true)
    setWarning(undefined)
    try {
      if (!simulation) {
        capture.current = new AudioCapture()
        const warnings = await capture.current.start({ micDeviceId: settings.audio.micDeviceId, prospectSource: settings.audio.prospectSource, mode: settings.transcriptionMode })
        if (warnings.length) setWarning(warnings.join(' '))
      }
      await window.autobuild.start()
    } catch (err) {
      setWarning(`Impossible de démarrer l'écoute : ${(err as Error).message}`)
      await capture.current?.stop()
      capture.current = undefined
    } finally {
      setBusy(false)
    }
  }

  const stop = async () => {
    setBusy(true)
    await capture.current?.stop()
    capture.current = undefined
    await window.autobuild.stop()
    setBusy(false)
  }

  const canStart = state.phase === 'pret' && (simulation || state.consentementAnnonce)
  const lv = state.transcription.levels

  return (
    <div className="col center">
      <div className="col-head" style={{ background: 'var(--panel)' }}>
        {listening ? <span className="recdot" /> : null}
        <h2>{listening ? (simulation ? 'Simulation en cours' : 'Écoute en cours') : 'Rendez-vous'}</h2>
        {listening && <span className="badge">{elapsed}</span>}
        <span className="spacer" />
        {listening && !simulation && (
          <div className="row small muted">
            Vous <div className="meter"><div style={{ width: `${lv.commercial * 100}%` }} /></div>
            Prospect <div className="meter"><div style={{ width: `${lv.prospect * 100}%` }} /></div>
          </div>
        )}
        {state.phase === 'pret' && (
          <button className="btn primary" disabled={!canStart || busy} onClick={start}>
            {simulation ? '▶ Lancer la simulation' : '● Démarrer l’écoute'}
          </button>
        )}
        {listening && (
          <button className="btn rec" disabled={busy} onClick={stop}>
            ■ Arrêter
          </button>
        )}
      </div>
      <div className="col-body">
        {state.phase === 'pret' && !simulation && (
          <label className="alert info" style={{ marginBottom: 14, cursor: 'pointer', alignItems: 'flex-start' }}>
            <input type="checkbox" checked={state.consentementAnnonce} onChange={(e) => void window.autobuild.setConsent(e.target.checked)} style={{ marginTop: 2 }} />
            <span>
              <b>RGPD :</b> j'ai informé le prospect que l'échange est transcrit pour préparer une maquette, et il est d'accord. (Aucun bot ne rejoint la visio ; l'audio n'est pas conservé.)
            </span>
          </label>
        )}
        {state.phase === 'pret' && simulation && (
          <div className="alert info" style={{ marginBottom: 14 }}>
            Mode démonstration : un faux rendez-vous va être rejoué (vitesse ×{state.simulation?.speed}). Le brief et la maquette se construisent comme en vrai.
            <span className="spacer" />
            <select className="input" style={{ width: 90 }} value={state.simulation?.speed} onChange={(e) => void window.autobuild.setSpeed(Number(e.target.value))}>
              {[1, 2, 5, 10, 20].map((s) => (
                <option key={s} value={s}>
                  ×{s}
                </option>
              ))}
            </select>
          </div>
        )}
        {warning && <div className="alert warn" style={{ marginBottom: 14 }}>{warning}</div>}
        {state.transcription.error && <div className="alert err" style={{ marginBottom: 14 }}>{state.transcription.error}</div>}

        {state.transcript.length === 0 && !state.interim.prospect && !state.interim.commercial ? (
          <div className="empty">
            <div style={{ fontSize: 28 }}>🎧</div>
            <div>La transcription s'affichera ici.</div>
            <div className="small">Micro = vous · Audio de la visio = le prospect</div>
          </div>
        ) : (
          <div className="transcript">
            {state.transcript.map((s) => (
              <div key={s.id} className={`bubble ${s.speaker}`}>
                <div className="meta">
                  {s.speaker === 'commercial' ? 'Vous' : 'Prospect'} · {formatTime(s.startMs)} · {s.id}
                </div>
                {s.text}
              </div>
            ))}
            {(['prospect', 'commercial'] as const).map((sp) =>
              state.interim[sp] ? (
                <div key={sp} className={`bubble ${sp} interim`}>
                  {state.interim[sp]}
                </div>
              ) : null
            )}
            <div ref={bottom} />
          </div>
        )}
      </div>
    </div>
  )
}
