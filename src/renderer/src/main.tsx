// Interface principale d'AutoBuild.
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { Rdv } from '@shared/types'
import { liveAudio } from './audio/live'
import { AppContext, type Ctx, type Keys, isLive, prospectOf, useAppData, useOnce, useSessionState, useSettings } from './lib/data'
import { dateCourte } from './lib/format'
import { type Route, go, useRoute } from './lib/router'
import { Accueil } from './pages/Accueil'
import { Aide } from './pages/Aide'
import { EnCours } from './pages/EnCours'
import { Lancement } from './pages/Lancement'
import { Preparation } from './pages/Preparation'
import { Prospects } from './pages/Prospects'
import { RdvForm, type RdvFormInit } from './pages/RdvForm'
import { RdvPasse } from './pages/RdvPasse'
import { Reglages, sectionLabel } from './pages/Reglages'
import { RendezVous } from './pages/RendezVous'
import { TemplateDetail, Templates } from './pages/Templates'
import { type Crumb, LiveBanner, Page, Sidebar, Topbar } from './shell/Shell'
import { Empty } from './ui/kit'
import './styles.css'

function App() {
  const live = useSessionState()
  const data = useAppData()
  const [settings, saveSettings] = useSettings()
  const [templates] = useOnce(() => window.autobuild.listTemplates())
  const [scenarios] = useOnce(() => window.autobuild.listScenarios())
  const [keys, reloadKeys] = useOnce<Keys>(() => window.autobuild.getKeysStatus())
  const route = useRoute()
  const [form, setForm] = useState<RdvFormInit | null>(null)
  const [lancement, setLancement] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; err?: boolean }>()
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const showToast = useCallback((msg: string, err?: boolean) => {
    setToast({ msg, err })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(undefined), err ? 6000 : 3200)
  }, [])

  // Le son s'arrête quand le rendez-vous quitte l'écoute (la fenêtre de lancement gère seule l'annulation).
  const phase = live?.phase
  const prevPhase = useRef(phase)
  useEffect(() => {
    if (prevPhase.current === 'ecoute' && phase !== 'ecoute') void liveAudio.stop()
    // Fin du rendez-vous : on arrive sur sa synthèse (la maquette est ouverte en plein écran par-dessus).
    if (phase === 'termine' && prevPhase.current !== 'termine' && live?.rdvId) go({ page: 'rdv', id: live.rdvId })
    prevPhase.current = phase
  }, [phase])
  // Réglages enregistrés : les accès IA ont pu changer.
  useEffect(() => {
    reloadKeys()
  }, [settings?.claude.mode])

  const ctx = useMemo<Ctx | null>(
    () => (live && data && settings ? { live, data, settings, saveSettings, templates: templates ?? [], scenarios: scenarios ?? [], keys, reloadKeys, toast: showToast } : null),
    [live, data, settings, templates, scenarios, keys]
  )
  if (!ctx) return null

  const start = (rdvId: string) => {
    if (isLive(ctx.live)) {
      if (ctx.live.rdvId === rdvId) void window.autobuild.showWidget()
      else showToast('Un rendez-vous est déjà en cours : terminez-le avant d’en démarrer un autre.', true)
      return
    }
    setLancement(rdvId)
  }
  const demo = async () => {
    const id = ctx.scenarios[0]?.id
    if (!id) return showToast('Scénario de démonstration introuvable.', true)
    const rdv = await window.autobuild.createDemoRdv(id)
    go({ page: 'rdv', id: rdv.id })
    start(rdv.id)
  }
  const { crumbs, content } = screen(route, ctx, { start, newRdv: (init) => setForm(init ?? {}), demo })

  return (
    <AppContext.Provider value={ctx}>
      <div className="app">
        <LiveBanner />
        <div className="app-body">
          <Sidebar route={route} onStart={start} />
          <div className="content">
            <Topbar crumbs={crumbs} onNew={() => setForm({})} />
            <div className="scroll">{content}</div>
          </div>
        </div>
        {form && <RdvForm init={form} onClose={() => setForm(null)} />}
        {lancement && <Lancement rdvId={lancement} onClose={() => setLancement(null)} />}
        {toast && (
          <div className={`toast${toast.err ? ' err' : ''}`} role="status">
            {toast.msg}
          </div>
        )}
      </div>
    </AppContext.Provider>
  )
}

interface Actions {
  start: (rdvId: string) => void
  newRdv: (init?: RdvFormInit) => void
  demo: () => Promise<void>
}

/** Écran et fil d'Ariane de chaque adresse. */
function screen(route: Route, ctx: Ctx, a: Actions): { crumbs: Crumb[]; content: React.ReactNode } {
  const { data, live, templates } = ctx
  switch (route.page) {
    case 'accueil':
      return { crumbs: [{ label: 'Accueil' }], content: <Accueil onStart={a.start} onNew={() => a.newRdv()} onDemo={() => void a.demo()} /> }
    case 'rdvs':
      return { crumbs: [{ label: 'Rendez-vous' }], content: <RendezVous route={route} onNew={() => a.newRdv()} /> }
    case 'rdv': {
      const rdv = data.rdvs.find((r) => r.id === route.id)
      if (!rdv)
        return {
          crumbs: [{ label: 'Rendez-vous', to: { page: 'rdvs' } }, { label: 'Introuvable' }],
          content: (
            <Page>
              <div className="card">
                <Empty icon="calendar" title="Rendez-vous introuvable" text="Il a peut-être été supprimé." />
              </div>
            </Page>
          )
        }
      const p = prospectOf(data, rdv)
      const base: Crumb[] = [
        { label: 'Rendez-vous', to: { page: 'rdvs' } },
        { label: `${p?.nom ?? ''} · ${dateCourte(rdv.debut)}`, to: { page: 'rdv', id: rdv.id } }
      ]
      const reprise = (r: Rdv) => () => a.newRdv({ prospectId: r.prospectId, repriseDe: r.id })
      if (live.rdvId === rdv.id && isLive(live)) return { crumbs: [...base, { label: 'En cours' }], content: <EnCours live={live} /> }
      if (rdv.statut === 'termine') {
        const tabs = { synthese: 'Synthèse', brief: 'Brief', transcription: 'Transcription', maquette: 'Maquette' }
        return { crumbs: route.tab && route.tab !== 'synthese' ? [...base, { label: tabs[route.tab] }] : base, content: <RdvPasse rdv={rdv} route={route} onReprise={reprise(rdv)} /> }
      }
      return { crumbs: base, content: <Preparation key={rdv.id} rdv={rdv} onStart={() => a.start(rdv.id)} onEdit={() => a.newRdv({ edit: rdv })} /> }
    }
    case 'prospects': {
      const p = data.prospects.find((x) => x.id === route.id)
      return { crumbs: [{ label: 'Prospects', to: { page: 'prospects' } }, ...(p ? [{ label: p.nom }] : [])], content: <Prospects id={route.id} onNew={(prospectId) => a.newRdv({ prospectId })} /> }
    }
    case 'templates':
      return { crumbs: [{ label: 'Templates' }], content: <Templates /> }
    case 'template': {
      const t = templates.find((x) => x.id === route.id)
      const pg = t?.pages.find((x) => x.id === route.pageId)
      return {
        crumbs: [{ label: 'Templates', to: { page: 'templates' } }, { label: t?.name ?? route.id, to: { page: 'template', id: route.id } }, ...(pg ? [{ label: pg.label }] : [])],
        content: <TemplateDetail id={route.id} pageId={route.pageId} />
      }
    }
    case 'reglages':
      return { crumbs: [{ label: 'Réglages', to: { page: 'reglages' } }, { label: sectionLabel(route.section) }], content: <Reglages section={route.section} /> }
    case 'aide':
      return { crumbs: [{ label: 'Aide et guide' }], content: <Aide /> }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
