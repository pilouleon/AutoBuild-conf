import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { SessionPhase } from '@shared/types'
import { BriefPanel } from './components/BriefPanel'
import { MockupPanel } from './components/MockupPanel'
import { PreparePage } from './components/PreparePage'
import { SettingsDialog } from './components/SettingsDialog'
import { TranscriptPanel } from './components/TranscriptPanel'
import { useSessionState, useSettings } from './hooks'
import './styles.css'

const STEPS: { label: string; phases: SessionPhase[] }[] = [
  { label: 'Préparer', phases: ['accueil', 'preparation'] },
  { label: 'Écouter', phases: ['pret', 'ecoute'] },
  { label: 'Montrer', phases: ['finalisation', 'termine'] }
]

function App() {
  const state = useSessionState()
  const [settings, reloadSettings] = useSettings()
  const [settingsOpen, setSettingsOpen] = useState(false)
  if (!state || !settings) return null
  const current = STEPS.findIndex((s) => s.phases.includes(state.phase))
  const inCall = !!state.generation.workspace || ['pret', 'ecoute', 'finalisation', 'termine'].includes(state.phase)

  return (
    <div className="app">
      <div className="topbar">
        <div className="logo">
          <span className="logo-mark">A</span> AutoBuild
        </div>
        <div className="steps">
          {STEPS.map((s, i) => (
            <div key={s.label} className={`step ${i === current ? 'active' : i < current ? 'done' : ''}`}>
              <span className="num">{i < current ? '✓' : i + 1}</span>
              {s.label}
            </div>
          ))}
        </div>
        <span className="spacer" />
        {state.brand && <span className="small muted">{state.brand.nomEntreprise}</span>}
        {inCall && (
          <button className="btn" onClick={() => confirm('Terminer ce rendez-vous et revenir à l’accueil ? (la maquette reste dans son dossier)') && void window.autobuild.reset()}>
            Nouveau rendez-vous
          </button>
        )}
        <button className="btn ghost" onClick={() => setSettingsOpen(true)}>
          ⚙ Réglages
        </button>
      </div>
      {inCall ? (
        <div className="call">
          <BriefPanel brief={state.brief} editable={state.phase !== 'accueil'} />
          <TranscriptPanel state={state} settings={settings} />
          <MockupPanel state={state} />
        </div>
      ) : (
        <PreparePage state={state} onSettings={() => setSettingsOpen(true)} />
      )}
      {settingsOpen && (
        <SettingsDialog
          onClose={() => {
            setSettingsOpen(false)
            reloadSettings()
          }}
        />
      )}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
