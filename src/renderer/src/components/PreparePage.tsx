// Écran d'accueil : préparer le rendez-vous (prospect + site) ou lancer une démonstration.
import { useEffect, useState } from 'react'
import type { KeysStatus, ScenarioInfo, SessionState, TemplateInfo } from '@shared/types'

export function PreparePage({ state, onSettings }: { state: SessionState; onSettings: () => void }) {
  const [nom, setNom] = useState('')
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([])
  const [scenario, setScenario] = useState('')
  const [speed, setSpeed] = useState(10)
  const [templates, setTemplates] = useState<TemplateInfo[]>([])
  const [keys, setKeys] = useState<KeysStatus>()
  const busy = state.phase === 'preparation'

  useEffect(() => {
    void window.autobuild.listScenarios().then((s) => {
      setScenarios(s)
      if (s[0]) setScenario(s[0].id)
    })
    void window.autobuild.listTemplates().then(setTemplates)
    void window.autobuild.getKeysStatus().then(setKeys)
  }, [])

  const readyTemplates = templates.filter((t) => t.ready)
  return (
    <div className="prepare">
      <div className="prepare-inner">
        <div className="stack" style={{ gap: 18 }}>
          <div>
            <h1>Préparer le rendez-vous</h1>
            <p className="promise">Votre prospect vous parle de son projet, vous lui montrez la maquette avant de raccrocher.</p>
          </div>

          {keys && (!keys.gemini || !keys.anthropic) && (
            <div className="alert warn">
              <span>
                {!keys.gemini && <>Clé <b>Gemini</b> manquante : la transcription en direct est impossible. </>}
                {!keys.anthropic && <>Clé <b>Claude</b> manquante : pas de génération sur mesure par l'IA (maquette de base uniquement). </>}
                <button className="btn sm" style={{ marginLeft: 6 }} onClick={onSettings}>
                  Ajouter les clés
                </button>
              </span>
            </div>
          )}
          {templates.length > 0 && readyTemplates.length === 0 && (
            <div className="alert err">Aucun template prêt : {templates[0]?.problem}</div>
          )}

          <div className="card card-pad stack">
            <label className="field">
              Entreprise du prospect
              <input className="input" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex. Ternovia" />
            </label>
            <label className="field">
              Site web du prospect
              <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="ex. www.entreprise.fr" />
              <span className="hint">Logo, couleurs, police et textes sont récupérés pour habiller la maquette à son image.</span>
            </label>
            <label className="field">
              Notes (facultatif)
              <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contexte du lead, appel d'offres, interlocuteurs…" />
            </label>
            <div className="row">
              <button className="btn primary big" disabled={busy || (!nom.trim() && !url.trim())} onClick={() => void window.autobuild.prepare({ nom: nom.trim(), url: url.trim(), notes })}>
                {busy ? 'Préparation…' : 'Préparer la maquette'}
              </button>
              <span className="hint">À faire quelques minutes avant l'appel : la maquette de départ et le plan B sont prêts avant de commencer.</span>
            </div>
          </div>
        </div>

        <div className="stack" style={{ gap: 18, paddingTop: 70 }}>
          <div className="card card-pad stack">
            <div>
              <b>Démonstration sans visio</b>
              <p className="small muted" style={{ marginTop: 4 }}>
                Rejoue un faux rendez-vous : transcription, brief, checklist et maquette se construisent comme en vrai. Fonctionne sans clé API.
              </p>
            </div>
            <select className="input" value={scenario} onChange={(e) => setScenario(e.target.value)}>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.titre} ({Math.round(s.dureeSec / 60)} min)
                </option>
              ))}
            </select>
            {scenarios.find((s) => s.id === scenario) && <p className="small muted">{scenarios.find((s) => s.id === scenario)!.description}</p>}
            <div className="row">
              <span className="small muted">Vitesse</span>
              <div className="seg">
                {[1, 5, 10, 20].map((s) => (
                  <button key={s} className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>
                    ×{s}
                  </button>
                ))}
              </div>
              <span className="spacer" />
              <button className="btn" disabled={busy || !scenario} onClick={() => void window.autobuild.prepareScenario(scenario, speed)}>
                Lancer la démo
              </button>
            </div>
          </div>

          <div className="card card-pad">
            <b className="small">Templates disponibles</b>
            <div className="stack" style={{ gap: 8, marginTop: 10 }}>
              {templates.map((t) => (
                <div key={t.id} className="row" style={{ alignItems: 'flex-start' }}>
                  <span className={`badge ${t.ready ? 'ok' : 'err'}`}>{t.ready ? 'prêt' : 'à installer'}</span>
                  <div>
                    <div style={{ fontWeight: 500 }}>
                      {t.name} <span className="muted small">({t.source === 'agence' ? 'agence' : 'intégré'})</span>
                    </div>
                    <div className="small muted">{t.projectTypes.includes('*') ? 'Tous types de projets (repli)' : t.projectTypes.join(', ')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
