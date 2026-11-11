// Colonne de droite : identité du prospect, étapes de génération, actions sur la maquette, journal.
import { useState } from 'react'
import type { SessionState } from '@shared/types'

const STATUS_LABEL: Record<string, string> = {
  inactif: 'En attente',
  preparation: 'Préparation…',
  pret: 'Prête',
  en_cours: 'L’IA travaille…',
  erreur: 'Erreur'
}

export function MockupPanel({ state }: { state: SessionState }) {
  const g = state.generation
  const b = state.brand
  const [showLogs, setShowLogs] = useState(true)
  const finalizing = state.phase === 'finalisation'
  return (
    <div className="col">
      <div className="col-head">
        <h2>Maquette</h2>
        <span className={`badge ${g.status === 'pret' ? 'ok' : g.status === 'erreur' ? 'err' : g.status === 'en_cours' ? 'accent' : ''}`}>{STATUS_LABEL[g.status]}</span>
        <span className="spacer" />
        <button className="btn primary" disabled={!g.previewUrl} onClick={() => void window.autobuild.openPreview()}>
          Ouvrir la maquette
        </button>
      </div>
      <div className="col-body stack">
        {b && (
          <div className="card card-pad">
            <div className="brand">
              <div className="brand-logo">{b.logoDataUrl ? <img src={b.logoDataUrl} alt="" /> : <b>{b.nomEntreprise.slice(0, 2).toUpperCase()}</b>}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{b.nomEntreprise}</div>
                <div className="small muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.url?.startsWith('file:') ? 'site de démonstration' : b.url}</div>
                <div className="swatches">
                  {[b.couleurs.primaire, b.couleurs.secondaire, b.couleurs.accent].filter(Boolean).map((c) => (
                    <span key={c} className="swatch" style={{ background: c }} title={c} />
                  ))}
                  {b.police && <span className="badge" style={{ marginLeft: 4 }}>{b.police}</span>}
                </div>
              </div>
            </div>
            {b.ton && <div className="small muted" style={{ marginTop: 8 }}>Ton : {b.ton}</div>}
          </div>
        )}

        {g.activity && (
          <div className="alert info">
            <span className="ic en_cours" style={{ width: 14, height: 14, borderRadius: 999, flexShrink: 0, marginTop: 2 }} />
            {g.activity}
          </div>
        )}

        <div className="card card-pad">
          <div className="row" style={{ marginBottom: 6 }}>
            <b className="small">Étapes</b>
            <span className="spacer" />
            {g.templateId && <span className="badge">template : {g.templateId}</span>}
          </div>
          {g.steps.length === 0 ? (
            <div className="small muted">La maquette sera préparée avant l'appel.</div>
          ) : (
            <div className="timeline">
              {g.steps.map((s) => (
                <div key={s.id} className="tl">
                  <span className={`ic ${s.status}`}>{s.status === 'ok' ? '✓' : s.status === 'echec' ? '!' : ''}</span>
                  <div>
                    <div className="t">{s.label}</div>
                    {s.message && <div className="m">{s.message}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="actions">
          <button className="btn primary" disabled={finalizing || state.phase === 'termine' || !g.workspace} onClick={() => void window.autobuild.finalize()}>
            {finalizing ? 'Finalisation…' : '✓ Finaliser'}
          </button>
          <button className="btn" onClick={() => void window.autobuild.openChecklist()}>
            Fenêtre checklist
          </button>
          <button className="btn" disabled={!g.lastGoodCommit} onClick={() => void window.autobuild.rollback('lastGood')} title="Annule la dernière modification si la maquette a un problème">
            ↶ Version sûre
          </button>
          <button className="btn danger" disabled={!g.planBCommit} onClick={() => confirm('Revenir à la maquette de secours (plan B) ?') && void window.autobuild.rollback('planB')}>
            Plan B
          </button>
          <button className="btn" disabled={g.status !== 'en_cours'} onClick={() => void window.autobuild.cancelAgent()}>
            Stopper l'IA
          </button>
          <button className="btn" disabled={!g.workspace} onClick={() => void window.autobuild.openWorkspace()}>
            Ouvrir le dossier
          </button>
          <button className="btn" disabled={state.transcript.length === 0} onClick={() => void window.autobuild.exportBrief()} style={{ gridColumn: 'span 2' }}>
            Exporter le brief (Markdown)
          </button>
        </div>

        <div>
          <div className="row" style={{ marginBottom: 6 }}>
            <b className="small">Journal</b>
            <span className="spacer" />
            <button className="btn ghost sm" onClick={() => setShowLogs(!showLogs)}>
              {showLogs ? 'Masquer' : 'Afficher'}
            </button>
          </div>
          {showLogs && (
            <div className="logs">
              {state.logs
                .slice(-80)
                .reverse()
                .map((l, i) => (
                  <div key={i} className={l.level}>
                    {new Date(l.at).toLocaleTimeString('fr-FR')} [{l.source}] {l.message}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
