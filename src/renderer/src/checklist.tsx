// Fenêtre flottante (toujours au premier plan, invisible au partage d'écran) :
// checklist de qualification en direct, questions suggérées, état de la maquette.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { FIELDS, GROUPS, progress } from '@shared/brief/schema'
import { getProjectType } from '@shared/catalog'
import { useElapsed, useSessionState } from './hooks'
import './checklist.css'

function Checklist() {
  const state = useSessionState()
  const elapsed = useElapsed(state?.phase === 'ecoute' ? state.startedAt : undefined)
  if (!state) return null
  const b = state.brief
  const p = progress(b)
  const g = state.generation
  const lastStep = [...g.steps].reverse().find((s) => s.status === 'en_cours') ?? g.steps[g.steps.length - 1]
  return (
    <div className="cl">
      <div className="cl-head drag">
        <div className="cl-title">
          {state.phase === 'ecoute' && <span className="cl-rec" />}
          <b>{state.brand?.nomEntreprise ?? 'Checklist'}</b>
          <span className="cl-time">{elapsed}</span>
        </div>
        <button className="cl-close nodrag" onClick={() => window.close()} title="Fermer">
          ✕
        </button>
      </div>
      <div className="cl-progress">
        <div className="cl-bar">
          <div style={{ width: `${p.pct}%` }} />
        </div>
        <span>{p.pct} %</span>
      </div>
      <div className="cl-type">{getProjectType(b.typeProjet)?.label ?? 'Type de projet à identifier'}</div>

      {b.questionsSuggerees.length > 0 && (
        <div className="cl-questions">
          <div className="cl-label">À demander maintenant</div>
          {b.questionsSuggerees.map((q) => (
            <div key={q.fieldId + q.question} className="cl-q">
              {q.question}
            </div>
          ))}
        </div>
      )}

      <div className="cl-body">
        {GROUPS.map((gr) => {
          const gp = progress(b, gr.id)
          return (
            <div key={gr.id} className="cl-group">
              <div className="cl-label">
                {gr.label}
                <span>
                  {gp.obtenu}/{gp.total}
                </span>
              </div>
              {FIELDS.filter((f) => f.groupe === gr.id).map((f) => {
                const c = b.champs[f.id]
                const st = c?.status ?? 'manquant'
                const val = c?.items?.length ? c.items.map((i) => i.nom).join(', ') : c?.valeur
                return (
                  <div key={f.id} className={`cl-item ${st}`}>
                    <span className={`cl-dot ${st}`}>{st === 'obtenu' ? '✓' : st === 'partiel' ? '•' : ''}</span>
                    <div className="cl-txt">
                      <span className="cl-name">{f.label}</span>
                      {st !== 'manquant' && val && <span className="cl-val">{val}</span>}
                    </div>
                    {st === 'manquant' && f.priorite === 1 && <span className="cl-key">clé</span>}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <div className="cl-foot">
        <span className={`cl-gen ${g.status}`} />
        <span className="cl-foot-txt">{g.activity ?? lastStep?.label ?? 'Maquette en attente'}</span>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Checklist />
  </StrictMode>
)
