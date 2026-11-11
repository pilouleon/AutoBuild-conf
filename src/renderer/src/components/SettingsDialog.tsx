// Réglages : clés API, fournisseurs et modèles, audio, signature de l'agence, dossiers.
import { useEffect, useState } from 'react'
import type { Settings } from '@shared/types'
import { listInputDevices } from '../audio/capture'

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState<Settings>()
  const [keys, setKeys] = useState<{ anthropic: boolean; gemini: boolean; chiffrement: boolean }>()
  const [anthropic, setAnthropic] = useState('')
  const [gemini, setGemini] = useState('')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [test, setTest] = useState<{ anthropic?: string; gemini?: string }>()
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    void window.autobuild.getSettings().then(setS)
    void window.autobuild.getKeysStatus().then(setKeys)
    void listInputDevices().then(setDevices)
  }, [])

  if (!s) return null
  const set = (patch: Partial<Settings>) => setS({ ...s, ...patch })
  const setModel = (k: keyof Settings['models'], v: string) => setS({ ...s, models: { ...s.models, [k]: v } })

  const save = async () => {
    if (anthropic.trim()) await window.autobuild.setKey('anthropic', anthropic)
    if (gemini.trim()) await window.autobuild.setKey('gemini', gemini)
    await window.autobuild.saveSettings(s)
    onClose()
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <b>Réglages</b>
          <button className="btn ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="dialog-body">
          <div className="section">
            <h3>Clés API</h3>
            <div className="grid2">
              <label className="field">
                Claude (Anthropic) {keys?.anthropic && <span className="badge ok">enregistrée</span>}
                <input className="input" type="password" value={anthropic} onChange={(e) => setAnthropic(e.target.value)} placeholder={keys?.anthropic ? '•••••• (laisser vide pour garder)' : 'sk-ant-…'} />
                <span className="hint">Brief (option) et génération de la maquette sur mesure.</span>
              </label>
              <label className="field">
                Gemini (Google) {keys?.gemini && <span className="badge ok">enregistrée</span>}
                <input className="input" type="password" value={gemini} onChange={(e) => setGemini(e.target.value)} placeholder={keys?.gemini ? '•••••• (laisser vide pour garder)' : 'AIza…'} />
                <span className="hint">Transcription en direct (et brief, en option).</span>
              </label>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button
                className="btn sm"
                disabled={testing}
                onClick={async () => {
                  setTesting(true)
                  if (anthropic.trim()) await window.autobuild.setKey('anthropic', anthropic)
                  if (gemini.trim()) await window.autobuild.setKey('gemini', gemini)
                  await window.autobuild.saveSettings(s)
                  setKeys(await window.autobuild.getKeysStatus())
                  setTest(await window.autobuild.testKeys())
                  setTesting(false)
                }}
              >
                {testing ? 'Test…' : 'Tester les clés'}
              </button>
              {test?.anthropic && <span className="small">Claude : {test.anthropic}</span>}
              {test?.gemini && <span className="small">Gemini : {test.gemini}</span>}
            </div>
            {keys && !keys.chiffrement && <p className="hint" style={{ marginTop: 6 }}>Chiffrement système indisponible : les clés sont stockées en clair dans le dossier de l'application.</p>}
          </div>

          <div className="section">
            <h3>Transcription (Gemini)</h3>
            <div className="row" style={{ marginBottom: 10 }}>
              <div className="seg">
                <button className={s.transcriptionMode === 'tronçons' ? 'on' : ''} onClick={() => set({ transcriptionMode: 'tronçons' })}>
                  Par tronçons (recommandé)
                </button>
                <button className={s.transcriptionMode === 'live' ? 'on' : ''} onClick={() => set({ transcriptionMode: 'live' })}>
                  Live (expérimental)
                </button>
              </div>
            </div>
            <div className="grid2">
              <label className="field">
                Modèle tronçons
                <input className="input" value={s.models.geminiTranscription} onChange={(e) => setModel('geminiTranscription', e.target.value)} list="gemini-models" />
              </label>
              <label className="field">
                Modèle live
                <input className="input" value={s.models.geminiLive} onChange={(e) => setModel('geminiLive', e.target.value)} list="gemini-live-models" />
              </label>
            </div>
          </div>

          <div className="section">
            <h3>Brief</h3>
            <div className="row" style={{ marginBottom: 10 }}>
              <span className="small muted">Fournisseur</span>
              <div className="seg">
                <button className={s.briefProvider === 'claude' ? 'on' : ''} onClick={() => set({ briefProvider: 'claude' })}>
                  Claude
                </button>
                <button className={s.briefProvider === 'gemini' ? 'on' : ''} onClick={() => set({ briefProvider: 'gemini' })}>
                  Gemini
                </button>
              </div>
              <span className="small muted" style={{ marginLeft: 12 }}>Mise à jour toutes les</span>
              <input className="input" type="number" min={10} max={120} style={{ width: 70 }} value={s.briefIntervalSec} onChange={(e) => set({ briefIntervalSec: Number(e.target.value) || 25 })} />
              <span className="small muted">s</span>
            </div>
            <div className="grid2">
              <label className="field">
                Modèle Claude (brief)
                <input className="input" value={s.models.claudeBrief} onChange={(e) => setModel('claudeBrief', e.target.value)} />
              </label>
              <label className="field">
                Modèle Gemini (brief)
                <input className="input" value={s.models.geminiBrief} onChange={(e) => setModel('geminiBrief', e.target.value)} list="gemini-models" />
              </label>
            </div>
          </div>

          <div className="section">
            <h3>Génération de la maquette (Claude)</h3>
            <label className="row small" style={{ marginBottom: 10 }}>
              <input type="checkbox" checked={s.generation.agentEnabled} onChange={(e) => set({ generation: { ...s.generation, agentEnabled: e.target.checked } })} />
              L'IA modifie le code de la maquette pendant l'appel (sinon : maquette de base uniquement)
            </label>
            <div className="grid2">
              <label className="field">
                Modèle
                <input className="input" value={s.models.claudeGenerator} onChange={(e) => setModel('claudeGenerator', e.target.value)} />
              </label>
              <label className="field">
                Durée max d'une étape (minutes)
                <input className="input" type="number" min={1} max={15} value={s.generation.maxAgentMinutes} onChange={(e) => set({ generation: { ...s.generation, maxAgentMinutes: Number(e.target.value) || 4 } })} />
              </label>
              <label className="field">
                Effort de l'IA (génération)
                <select className="input" value={s.generatorEffort} onChange={(e) => set({ generatorEffort: e.target.value as Settings['generatorEffort'] })}>
                  <option value="low">Rapide</option>
                  <option value="medium">Équilibré</option>
                  <option value="high">Soigné (plus lent)</option>
                </select>
              </label>
              <label className="field">
                Effort de l'IA (brief)
                <select className="input" value={s.briefEffort} onChange={(e) => set({ briefEffort: e.target.value as Settings['briefEffort'] })}>
                  <option value="low">Rapide</option>
                  <option value="medium">Équilibré</option>
                  <option value="high">Soigné (plus lent)</option>
                </select>
              </label>
            </div>
          </div>

          <div className="section">
            <h3>Audio</h3>
            <div className="grid2">
              <label className="field">
                Micro (vous)
                <select className="input" value={s.audio.micDeviceId} onChange={(e) => set({ audio: { ...s.audio, micDeviceId: e.target.value } })}>
                  <option value="default">Micro par défaut</option>
                  {devices.filter((d) => d.deviceId !== 'default').map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || d.deviceId.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Voix du prospect
                <select className="input" value={s.audio.prospectSource} onChange={(e) => set({ audio: { ...s.audio, prospectSource: e.target.value } })}>
                  <option value="system">Audio système (son de la visio)</option>
                  {devices.filter((d) => d.deviceId !== 'default').map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      Entrée : {d.label || d.deviceId.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="hint" style={{ marginTop: 8, lineHeight: 1.5 }}>
              Utilisez un casque : sinon le micro capte aussi la voix du prospect. Sur macOS, autorisez « Enregistrement de l'écran et de l'audio système » pour AutoBuild ; si l'audio système reste muet, installez un périphérique virtuel (ex. BlackHole) et choisissez-le comme « Voix du prospect ».
            </p>
          </div>

          <div className="section">
            <h3>Signature de l'agence</h3>
            <div className="grid2">
              <label className="field">
                Nom de l'agence
                <input className="input" value={s.agence.nom} onChange={(e) => set({ agence: { ...s.agence, nom: e.target.value } })} />
              </label>
              <label className="field">
                Mention dans la maquette
                <input className="input" value={s.agence.mention} onChange={(e) => set({ agence: { ...s.agence, mention: e.target.value } })} />
              </label>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn sm" onClick={async () => { const p = await window.autobuild.chooseImage('Logo de l’agence'); if (p) set({ agence: { ...s.agence, logoPath: p } }) }}>
                Choisir le logo de l'agence
              </button>
              <span className="hint">{s.agence.logoPath ?? 'aucun'}</span>
            </div>
          </div>

          <div className="section">
            <h3>Dossiers</h3>
            <div className="stack" style={{ gap: 8 }}>
              <div className="row">
                <button className="btn sm" onClick={async () => { const p = await window.autobuild.chooseFolder('Templates de l’agence'); if (p) set({ templatesDir: p }) }}>
                  Templates de l'agence…
                </button>
                <span className="hint">{s.templatesDir || 'aucun (templates intégrés uniquement)'}</span>
                {s.templatesDir && <button className="btn ghost sm" onClick={() => set({ templatesDir: '' })}>retirer</button>}
              </div>
              <div className="row">
                <button className="btn sm" onClick={async () => { const p = await window.autobuild.chooseFolder('Dossier des maquettes'); if (p) set({ workspacesDir: p }) }}>
                  Dossier des maquettes…
                </button>
                <span className="hint">{s.workspacesDir}</span>
              </div>
            </div>
          </div>

          <datalist id="gemini-models">
            <option value="gemini-3.8-flash" />
            <option value="gemini-3.5-transcribe" />
            <option value="gemini-3.6-flash" />
            <option value="gemini-3.5-flash-lite" />
            <option value="gemini-4-carbon" />
          </datalist>
          <datalist id="gemini-live-models">
            <option value="gemini-3.8-live" />
            <option value="gemini-3.5-transcribe-live" />
          </datalist>
        </div>
        <div className="dialog-foot">
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn primary" onClick={() => void save()}>
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}
