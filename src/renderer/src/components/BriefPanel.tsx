// Brief / checklist détaillée (fenêtre principale) : statut, valeur, preuve, saisie manuelle.
import { useState } from 'react'
import { type Brief, FIELDS, GROUPS, progress } from '@shared/brief/schema'
import { getProjectType } from '@shared/catalog'

export function StatusDot({ status }: { status: string }) {
  return <span className={`dot ${status}`}>{status === 'obtenu' ? '✓' : status === 'partiel' ? '½' : ''}</span>
}

export function BriefPanel({ brief, editable }: { brief: Brief; editable: boolean }) {
  const [editing, setEditing] = useState<string>()
  const [draft, setDraft] = useState('')
  const p = progress(brief)
  const pt = getProjectType(brief.typeProjet)
  return (
    <div className="col">
      <div className="col-head">
        <h2>Brief du prospect</h2>
        <span className="spacer" />
        <span className="badge accent">{p.pct} %</span>
      </div>
      <div className="col-body">
        <div className="progress">
          <div style={{ width: `${p.pct}%` }} />
        </div>
        <div className="row small muted" style={{ marginTop: 6 }}>
          {p.obtenu} obtenues · {p.partiel} partielles · {p.total - p.obtenu - p.partiel} manquantes
        </div>

        <div className="card card-pad" style={{ marginTop: 14 }}>
          <div className="small muted">Type de projet</div>
          <div style={{ fontWeight: 600, marginTop: 2 }}>{pt?.label ?? 'Pas encore identifié'}</div>
          {brief.resume && <p className="small" style={{ marginTop: 8, color: 'var(--ink-2)', lineHeight: 1.45 }}>{brief.resume}</p>}
        </div>

        {brief.questionsSuggerees.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div className="group-head">Questions à poser</div>
            <div className="questions">
              {brief.questionsSuggerees.map((q) => (
                <div key={q.fieldId + q.question} className="question">
                  {q.question}
                </div>
              ))}
            </div>
          </div>
        )}

        {GROUPS.map((g) => {
          const gp = progress(brief, g.id)
          return (
            <div key={g.id} className="group">
              <div className="group-head">
                <span>{g.label}</span>
                <span>
                  {gp.obtenu}/{gp.total}
                </span>
              </div>
              {FIELDS.filter((f) => f.groupe === g.id).map((f) => {
                const c = brief.champs[f.id]
                const proof = c?.preuves[0]
                if (editing === f.id)
                  return (
                    <div key={f.id} className="item" style={{ flexDirection: 'column', cursor: 'default' }}>
                      <div className="lbl">{f.label}</div>
                      <textarea className="input" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={f.type === 'liste' ? 'Une valeur par ligne' : ''} />
                      <div className="row">
                        <button
                          className="btn sm primary"
                          onClick={() => {
                            void window.autobuild.setManual(f.id, draft)
                            setEditing(undefined)
                          }}
                        >
                          Enregistrer
                        </button>
                        <button className="btn sm" onClick={() => setEditing(undefined)}>
                          Annuler
                        </button>
                        <span className="hint">Une saisie manuelle n'est jamais écrasée par l'IA.</span>
                      </div>
                    </div>
                  )
                return (
                  <div
                    key={f.id}
                    className={`item ${c?.status ?? 'manquant'}`}
                    title={editable ? 'Cliquer pour saisir ou corriger' : undefined}
                    onClick={() => {
                      if (!editable) return
                      setDraft(c?.items?.length ? c.items.map((i) => i.nom).join('\n') : (c?.valeur ?? ''))
                      setEditing(f.id)
                    }}
                  >
                    <StatusDot status={c?.status ?? 'manquant'} />
                    <div style={{ minWidth: 0 }}>
                      <div className="lbl">
                        {f.label}
                        {f.priorite === 1 && c?.status === 'manquant' && <span className="badge warn" style={{ marginLeft: 6 }}>clé</span>}
                      </div>
                      {c && c.status !== 'manquant' && (
                        <>
                          <div className="val">{c.items?.length ? c.items.map((i) => i.nom + (i.attributs?.length ? ` (${i.attributs.join(', ')})` : '')).join(' · ') : c.valeur}</div>
                          {proof && (
                            <div className="src">
                              {proof.source === 'transcript' ? `« ${proof.citation} »` : proof.source === 'site' ? 'd’après le site web' : 'saisi par vous'}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
