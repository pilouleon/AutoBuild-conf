// Interface pendant le rendez-vous (quand on revient du widget) : brief, maquette et transcription en direct.
import { useEffect, useRef } from 'react'
import { formatTime } from '@shared/brief/prompt'
import { GROUPS, allFields, progress } from '@shared/brief/schema'
import { maquetteProgress } from '@shared/mockup/progress'
import type { SessionState } from '@shared/types'
import { useApp } from '../lib/data'
import { Page } from '../shell/Shell'
import { Icon } from '../ui/icons'
import { Card, Progress, StepIcon } from '../ui/kit'

export function EnCours({ live }: { live: SessionState }) {
  const { settings, toast } = useApp()
  const brief = live.brief
  const pct = progress(brief).pct
  const mq = maquetteProgress(live.generation, brief, live.phase)
  const fields = allFields(brief)
  const bottom = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [live.transcript.length])
  const nomCommercial = settings.profil.nom || 'Vous'

  return (
    <Page wide>
      <div className="grid3" style={{ gap: 24, alignItems: 'start', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.3fr)' }}>
        <Card title="Brief" action={<span className="badge ok">{pct} %</span>}>
          <div style={{ padding: '14px 20px 6px' }}>
            <Progress pct={pct} />
          </div>
          <div style={{ padding: '6px 0' }}>
            {GROUPS.map((g) => {
              const gf = fields.filter((f) => f.groupe === g.id)
              const n = gf.filter((f) => brief.champs[f.id]?.status !== 'manquant').length
              return (
                <div key={g.id} className="rowlink" style={{ padding: '10px 20px' }}>
                  <span style={{ flex: 1 }}>{g.label}</span>
                  <span className="strong tabular" style={{ color: n === gf.length ? 'var(--ok)' : n === 0 ? 'var(--warn)' : 'var(--ink)' }}>
                    {n}/{gf.length}
                  </span>
                </div>
              )
            })}
          </div>
          <div style={{ padding: '6px 20px 16px' }}>
            <button className="link" onClick={() => void window.autobuild.showWidget()}>
              Voir la checklist détaillée
            </button>
          </div>
        </Card>

        <Card title="Maquette" action={<span className="badge wip">{mq.pct} %</span>}>
          <div style={{ padding: '14px 20px 6px' }}>
            <Progress pct={mq.pct} tone="indigo" />
          </div>
          <ol className="steps-list" style={{ padding: '14px 20px' }}>
            {mq.etapes.map((e) => (
              <li key={e.id} className="step-item">
                <StepIcon etat={e.etat} />
                <span>
                  <span style={{ display: 'block', fontWeight: e.etat === 'en_cours' ? 700 : 600, color: e.etat === 'a_venir' || e.etat === 'sans_objet' ? 'var(--ink-3)' : undefined }}>{e.label}</span>
                  <span className="small muted">{e.detail}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="row" style={{ padding: '0 20px 18px' }}>
            <button className="btn sm" disabled={!live.generation.previewUrl || !live.rdvId} onClick={() => live.rdvId && void window.autobuild.presentMaquette(live.rdvId).catch((e: Error) => toast(e.message, true))}>
              <Icon name="present" size={15} /> Aperçu en direct
            </button>
            <button className="btn sm ghost" disabled={!live.generation.lastGoodCommit} onClick={() => void window.autobuild.rollback('lastGood').then(() => toast('Dernière version valide restaurée.'))}>
              <Icon name="restore" size={15} /> Version sûre
            </button>
          </div>
        </Card>

        <Card title="Transcription" action={live.briefStatus.running ? <span className="badge wip"><span className="spinner" style={{ width: 10, height: 10 }} /> brief</span> : undefined}>
          <div style={{ maxHeight: 'calc(100vh - 290px)', overflowY: 'auto', padding: '8px 20px 16px' }}>
            {live.transcript.length === 0 && <p className="small muted" style={{ padding: '10px 0' }}>Les échanges apparaissent ici au fil de l’appel.</p>}
            {live.transcript.map((s) => (
              <p key={s.id} className="small" style={{ padding: '8px 0', borderBottom: '1px solid var(--line-3)' }}>
                <b style={{ color: s.speaker === 'commercial' ? 'var(--accent-link)' : 'var(--ink)' }}>{s.speaker === 'commercial' ? nomCommercial : 'Prospect'}</b> <span className="xs muted tabular">{formatTime(s.startMs)}</span>
                <br />
                {s.text}
              </p>
            ))}
            {(live.interim.prospect || live.interim.commercial) && <p className="small muted" style={{ padding: '8px 0', fontStyle: 'italic' }}>{live.interim.prospect ?? live.interim.commercial}</p>}
            <div ref={bottom} />
          </div>
        </Card>
      </div>
    </Page>
  )
}
