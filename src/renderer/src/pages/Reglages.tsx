// Réglages : mon compte (profil, micro et son, widget), agence (signature, templates, grille), connexions (IA, agenda).
import { useEffect, useState } from 'react'
import { FIELDS, GROUPS } from '@shared/brief/schema'
import type { Settings } from '@shared/types'
import { listInputDevices } from '../audio/capture'
import { type LiveAudioState, liveAudio } from '../audio/live'
import { isLive, useApp } from '../lib/data'
import { href } from '../lib/router'
import { Page } from '../shell/Shell'
import { Icon } from '../ui/icons'
import { Card, Meter, cx } from '../ui/kit'

export const SECTIONS = [
  { titre: 'Mon compte', items: [['profil', 'Profil'], ['son', 'Micro et son'], ['widget', 'Widget checklist']] },
  { titre: 'Agence', items: [['agence', 'Agence et signature'], ['templates', 'Templates de l’agence'], ['grille', 'Grille de qualification'], ['donnees', 'Données et dossiers']] },
  { titre: 'Connexions', items: [['ia', 'Accès IA'], ['agenda', 'Agenda']] }
] as const

export function sectionLabel(id?: string): string {
  for (const s of SECTIONS) for (const [k, l] of s.items) if (k === id) return l
  return 'Profil'
}

export function Reglages({ section = 'profil' }: { section?: string }) {
  const { settings, saveSettings, toast } = useApp()
  const [s, setS] = useState<Settings>(settings)
  useEffect(() => {
    setS(settings)
  }, [settings])
  const dirty = JSON.stringify(s) !== JSON.stringify(settings)
  const save = async () => {
    await saveSettings(s)
    toast('Réglages enregistrés.')
  }
  return (
    <div style={{ display: 'flex', minHeight: '100%' }}>
      <nav aria-label="Sections des réglages" style={{ width: 240, flexShrink: 0, background: '#fff', borderRight: '1px solid var(--line)', padding: '22px 10px' }}>
        {SECTIONS.map((g) => (
          <div key={g.titre} style={{ marginBottom: 18 }}>
            <p className="section-title" style={{ padding: '0 10px 6px' }}>
              {g.titre}
            </p>
            {g.items.map(([k, l]) => (
              <a key={k} href={href({ page: 'reglages', section: k })} className={cx('nav-item', section === k && 'on')} aria-current={section === k ? 'page' : undefined}>
                {l}
              </a>
            ))}
          </div>
        ))}
      </nav>
      <Page>
        <div style={{ maxWidth: 760 }} className="stack">
          {section === 'profil' && <Profil s={s} setS={setS} />}
          {section === 'son' && <Son s={s} setS={setS} />}
          {section === 'widget' && <Widget s={s} setS={setS} />}
          {section === 'agence' && <Agence s={s} setS={setS} />}
          {section === 'templates' && <TemplatesAgence s={s} setS={setS} />}
          {section === 'grille' && <Grille />}
          {section === 'donnees' && <Donnees s={s} setS={setS} />}
          {section === 'ia' && <Ia s={s} setS={setS} />}
          {section === 'agenda' && <Agenda />}
          {dirty && (
            <div className="row" style={{ position: 'sticky', bottom: 16, justifyContent: 'flex-end', padding: '12px 16px', background: '#fff', border: '1px solid var(--line)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
              <span className="small muted" style={{ flex: 1 }}>
                Modifications non enregistrées
              </span>
              <button className="btn ghost" onClick={() => setS(settings)}>
                Annuler
              </button>
              <button className="btn primary" onClick={() => void save()}>
                Enregistrer
              </button>
            </div>
          )}
        </div>
      </Page>
    </div>
  )
}

type P = { s: Settings; setS: (s: Settings) => void }

function Head({ titre, texte }: { titre: string; texte: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <h1 className="h1">{titre}</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        {texte}
      </p>
    </div>
  )
}

function Profil({ s, setS }: P) {
  return (
    <>
      <Head titre="Profil" texte="Votre nom apparaît dans les rendez-vous et les comptes rendus." />
      <Card>
        <div className="grid2" style={{ padding: 20 }}>
          <label className="field">
            Prénom et nom
            <input className="input" value={s.profil.nom} onChange={(e) => setS({ ...s, profil: { ...s.profil, nom: e.target.value } })} placeholder="Camille Martin" />
          </label>
          <label className="field">
            Fonction
            <input className="input" value={s.profil.fonction} onChange={(e) => setS({ ...s, profil: { ...s.profil, fonction: e.target.value } })} />
          </label>
        </div>
      </Card>
    </>
  )
}

function Son({ s, setS }: P) {
  const { live } = useApp()
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [audio, setAudio] = useState<LiveAudioState>(liveAudio.state)
  const [testing, setTesting] = useState(false)
  useEffect(() => void listInputDevices().then(setDevices), [])
  useEffect(() => {
    const off = liveAudio.subscribe(setAudio)
    return () => {
      off()
    }
  }, [])
  useEffect(
    () => () => {
      if (testing && !isLive(live)) void liveAudio.stop()
    },
    [testing]
  )
  const mac = window.autobuild.platform === 'darwin'
  const dev = devices.filter((d) => d.deviceId !== 'default' && d.deviceId !== 'communications')
  return (
    <>
      <Head titre="Micro et son" texte="Votre micro capte votre voix ; le son de l’ordinateur capte celle du prospect, sans bot dans la visio." />
      <Card>
        <div className="stack" style={{ padding: 20, gap: 16 }}>
          <div className="grid2">
            <label className="field">
              Votre micro
              <select className="input" value={s.audio.micDeviceId} onChange={(e) => setS({ ...s, audio: { ...s.audio, micDeviceId: e.target.value } })}>
                <option value="default">Micro par défaut du système</option>
                {dev.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || d.deviceId.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Voix du prospect
              <select className="input" value={s.audio.prospectSource} onChange={(e) => setS({ ...s, audio: { ...s.audio, prospectSource: e.target.value } })}>
                <option value="system">Son de l’ordinateur (recommandé)</option>
                {dev.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    Entrée : {d.label || d.deviceId.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="row wrap" style={{ gap: 18, padding: '12px 14px', borderRadius: 12, background: 'var(--soft)' }}>
            <button
              className="btn sm"
              disabled={isLive(live)}
              onClick={async () => {
                if (testing) {
                  await liveAudio.stop()
                  setTesting(false)
                } else {
                  setTesting(true)
                  await liveAudio.test(s)
                }
              }}
            >
              {testing ? 'Arrêter le test' : 'Tester le son'}
            </button>
            <span className="row small">
              <Icon name="mic" size={16} /> Vous <Meter level={audio.levels.commercial} />
            </span>
            <span className="row small">
              <Icon name="speaker" size={16} /> Prospect <Meter level={audio.levels.prospect} />
            </span>
            {testing && <span className="xs muted">Parlez, puis lancez une vidéo avec du son.</span>}
          </div>
          {audio.error && <p className="small" style={{ color: 'var(--err)' }}>Micro inaccessible : {audio.error}</p>}
          {audio.warnings.map((w) => (
            <p key={w} className="small" style={{ color: 'var(--warn)' }}>
              {w}
            </p>
          ))}
          <label className="field">
            Transcription
            <select className="input" value={s.transcriptionMode} onChange={(e) => setS({ ...s, transcriptionMode: e.target.value as Settings['transcriptionMode'] })}>
              <option value="tronçons">Par tronçons (recommandé)</option>
              <option value="live">En continu (expérimental)</option>
            </select>
          </label>
        </div>
      </Card>
      <Card title="Conseils">
        <ul className="stack small" style={{ padding: 20, gap: 8, color: 'var(--ink-2)' }}>
          <li>• Utilisez un casque : sinon votre micro capte aussi la voix du prospect.</li>
          {mac ? (
            <>
              <li>
                • macOS : autorisez AutoBuild dans <b>Réglages Système › Confidentialité et sécurité › Enregistrement de l’écran et de l’audio système</b>, puis relancez l’application.
              </li>
              <li>• Si le son du prospect reste muet, installez un périphérique audio virtuel (par exemple BlackHole) et choisissez-le comme « Voix du prospect ».</li>
            </>
          ) : (
            <li>• Windows : le son de l’ordinateur est capté directement, sans réglage.</li>
          )}
        </ul>
      </Card>
    </>
  )
}

function Widget({ s, setS }: P) {
  const mac = window.autobuild.platform === 'darwin'
  return (
    <>
      <Head titre="Widget checklist" texte="Pendant un rendez-vous, l’interface se retire et seule cette petite fenêtre reste, par-dessus votre visio." />
      <Card>
        <ul className="stack small" style={{ padding: 20, gap: 10, color: 'var(--ink-2)' }}>
          <li>
            <b>Toujours par-dessus</b> les autres fenêtres, même une visio en plein écran.
          </li>
          <li>
            <b>Invisible</b> dans un partage d’écran : le prospect ne la voit jamais.
          </li>
          <li>
            <b>Déplaçable</b> (par sa barre du haut) et redimensionnable ; sa position est mémorisée.
          </li>
          <li>
            <b>Réduite</b> en pastille avec le bouton « – » : chrono, brief et maquette restent visibles.
          </li>
          <li>
            <b>Raccourci</b> {mac ? '⌥ ⌘ C' : 'Ctrl Alt C'} : passer du widget à l’interface et inversement.
          </li>
        </ul>
        <div className="card-foot">
          <span className="muted">{s.widget.bounds ? `Position mémorisée (${s.widget.bounds.width} × ${s.widget.bounds.height})` : 'Position par défaut : en haut à droite, 1/5 de l’écran'}</span>
          <span className="spacer" />
          <button className="btn sm" disabled={!s.widget.bounds} onClick={() => setS({ ...s, widget: {} })}>
            Revenir à la position par défaut
          </button>
        </div>
      </Card>
    </>
  )
}

function Agence({ s, setS }: P) {
  return (
    <>
      <Head titre="Agence et signature" texte="Le nom et la mention de l’agence apparaissent discrètement dans chaque maquette." />
      <Card>
        <div className="stack" style={{ padding: 20, gap: 16 }}>
          <div className="grid2">
            <label className="field">
              Nom de l’agence
              <input className="input" value={s.agence.nom} onChange={(e) => setS({ ...s, agence: { ...s.agence, nom: e.target.value } })} placeholder="Studio Kalis" />
            </label>
            <label className="field">
              Mention dans la maquette
              <input className="input" value={s.agence.mention} onChange={(e) => setS({ ...s, agence: { ...s.agence, mention: e.target.value } })} />
            </label>
          </div>
          <div className="row">
            <button
              className="btn sm"
              onClick={async () => {
                const p = await window.autobuild.chooseImage('Logo de l’agence')
                if (p) setS({ ...s, agence: { ...s.agence, logoPath: p } })
              }}
            >
              Choisir le logo
            </button>
            <span className="small muted ellipsis">{s.agence.logoPath ?? 'Aucun logo'}</span>
            {s.agence.logoPath && (
              <button className="link" onClick={() => setS({ ...s, agence: { ...s.agence, logoPath: undefined } })}>
                retirer
              </button>
            )}
          </div>
        </div>
      </Card>
    </>
  )
}

function TemplatesAgence({ s, setS }: P) {
  const { templates } = useApp()
  const agence = templates.filter((t) => t.source === 'agence')
  return (
    <>
      <Head titre="Templates de l’agence" texte="Vos propres templates s’ajoutent aux templates intégrés (et remplacent un intégré de même identifiant)." />
      <Card>
        <div className="stack" style={{ padding: 20, gap: 12 }}>
          <div className="row">
            <button
              className="btn sm"
              onClick={async () => {
                const p = await window.autobuild.chooseFolder('Dossier des templates de l’agence')
                if (p) setS({ ...s, templatesDir: p })
              }}
            >
              <Icon name="folder" size={15} /> Choisir le dossier
            </button>
            <span className="small muted ellipsis">{s.templatesDir || 'Aucun dossier'}</span>
            {s.templatesDir && (
              <button className="link" onClick={() => setS({ ...s, templatesDir: '' })}>
                retirer
              </button>
            )}
          </div>
          <p className="hint">Chaque sous-dossier contient un template.json : un projet complet, ou un manifeste qui étend le socle (« extends »). Voir docs/templates.md.</p>
        </div>
        {agence.map((t) => (
          <div key={t.id} className="rowlink">
            <span style={{ flex: 1 }}>
              <b>{t.name}</b>
              <span className="small muted" style={{ display: 'block' }}>
                {t.ready ? `${t.pages.length} pages` : t.problem}
              </span>
            </span>
            <span className={cx('badge', t.ready ? 'ok' : 'err')}>{t.ready ? 'Prêt' : 'À corriger'}</span>
          </div>
        ))}
      </Card>
    </>
  )
}

function Grille() {
  return (
    <>
      <Head titre="Grille de qualification" texte="Les infos à obtenir pendant un premier rendez-vous. Les infos propres au type de projet, et celles que l’IA juge importantes pour ce prospect, s’ajoutent pendant l’appel." />
      {GROUPS.map((g) => (
        <Card key={g.id} title={g.label}>
          {FIELDS.filter((f) => f.groupe === g.id).map((f) => (
            <div key={f.id} className="rowlink" style={{ alignItems: 'flex-start' }}>
              <span style={{ flex: 1 }}>
                <b style={{ display: 'block' }}>{f.label}</b>
                <span className="small muted">{f.description}</span>
              </span>
              {f.priorite === 1 && <span className="badge wip">Clé</span>}
              {f.maquette && <span className="badge">Maquette</span>}
            </div>
          ))}
        </Card>
      ))}
    </>
  )
}

function Donnees({ s, setS }: P) {
  return (
    <>
      <Head titre="Données et dossiers" texte="Rendez-vous, briefs et transcriptions sont enregistrés sur ce poste. Les maquettes sont des dossiers de projet, à ouvrir ou partager." />
      <Card>
        <div className="stack" style={{ padding: 20, gap: 12 }}>
          <div className="row">
            <button
              className="btn sm"
              onClick={async () => {
                const p = await window.autobuild.chooseFolder('Dossier des maquettes')
                if (p) setS({ ...s, workspacesDir: p })
              }}
            >
              <Icon name="folder" size={15} /> Dossier des maquettes
            </button>
            <span className="small muted ellipsis">{s.workspacesDir}</span>
          </div>
          <p className="hint">Les données ne sont pas synchronisées entre les postes pour l’instant : chaque commercial retrouve l’historique de ses propres rendez-vous.</p>
        </div>
      </Card>
    </>
  )
}

function Ia({ s, setS }: P) {
  const { keys, reloadKeys } = useApp()
  const [anthropic, setAnthropic] = useState('')
  const [gemini, setGemini] = useState('')
  const [test, setTest] = useState<{ anthropic?: string; gemini?: string }>()
  const [cc, setCc] = useState<{ ok: boolean; message: string }>()
  const [busy, setBusy] = useState<string>()
  const model = (k: keyof Settings['models'], v: string) => setS({ ...s, models: { ...s.models, [k]: v } })
  const saveKey = async (name: 'anthropic' | 'gemini', v: string) => {
    await window.autobuild.setKey(name, v)
    reloadKeys()
  }
  return (
    <>
      <Head titre="Accès IA" texte="Claude construit le brief et la maquette ; Gemini transcrit la visio." />
      <Card title="Claude" action={<span className={cx('badge', keys?.claude ? 'ok' : 'todo')}>{keys?.claude ? 'Connecté' : 'Non configuré'}</span>}>
        <div className="stack" style={{ padding: 20, gap: 12 }}>
          <div role="radiogroup" aria-label="Mode d’accès à Claude" className="stack" style={{ gap: 10 }}>
            <label className={cx('radio-card', s.claude.mode === 'claude-code' && 'on')}>
              <input type="radio" checked={s.claude.mode === 'claude-code'} onChange={() => setS({ ...s, claude: { ...s.claude, mode: 'claude-code' } })} />
              <span>
                <b style={{ display: 'block' }}>Claude Code installé</b>
                <span className="small muted">
                  Utilise le Claude Code de ce poste, avec sa propre connexion et votre abonnement. AutoBuild ne lit ni ne stocke aucun identifiant. Pour tester sur votre poste.
                </span>
                {keys?.claudeCodePath && <span className="xs" style={{ display: 'block', color: 'var(--ok)', marginTop: 4 }}>Détecté : {keys.claudeCodePath}</span>}
              </span>
            </label>
            <label className={cx('radio-card', s.claude.mode === 'api' && 'on')}>
              <input type="radio" checked={s.claude.mode === 'api'} onChange={() => setS({ ...s, claude: { ...s.claude, mode: 'api' } })} />
              <span>
                <b style={{ display: 'block' }}>Clé API Anthropic</b>
                <span className="small muted">Facturation à l’usage, une clé par agence. Mode prévu pour la version distribuée aux agences.</span>
              </span>
            </label>
          </div>
          {s.claude.mode === 'api' ? (
            <div className="row">
              <input className="input" type="password" value={anthropic} onChange={(e) => setAnthropic(e.target.value)} placeholder={keys?.anthropic ? '•••••••• enregistrée (saisir pour remplacer)' : 'sk-ant-…'} />
              <button className="btn" disabled={!anthropic.trim()} onClick={() => void saveKey('anthropic', anthropic).then(() => setAnthropic(''))}>
                Enregistrer
              </button>
            </div>
          ) : (
            <label className="field">
              Chemin de « claude » (facultatif)
              <input className="input" value={s.claude.cliPath} onChange={(e) => setS({ ...s, claude: { ...s.claude, cliPath: e.target.value } })} placeholder="Détection automatique" />
            </label>
          )}
          <div className="row">
            <button
              className="btn sm"
              disabled={!!busy}
              onClick={async () => {
                setBusy('claude')
                await window.autobuild.saveSettings(s)
                if (s.claude.mode === 'claude-code') setCc(await window.autobuild.testClaudeCode())
                else setTest(await window.autobuild.testKeys())
                reloadKeys()
                setBusy(undefined)
              }}
            >
              {busy === 'claude' ? 'Test en cours…' : 'Tester la connexion'}
            </button>
            {s.claude.mode === 'claude-code' && cc && <span className="small" style={{ color: cc.ok ? 'var(--ok)' : 'var(--err)' }}>{cc.message}</span>}
            {s.claude.mode === 'api' && test?.anthropic && <span className="small">{test.anthropic}</span>}
          </div>
        </div>
      </Card>
      <Card title="Gemini · transcription" action={<span className={cx('badge', keys?.gemini ? 'ok' : 'todo')}>{keys?.gemini ? 'Clé enregistrée' : 'Non configuré'}</span>}>
        <div className="stack" style={{ padding: 20, gap: 12 }}>
          <label className="field">
            Clé API
            <div className="row">
              <input className="input" type="password" value={gemini} onChange={(e) => setGemini(e.target.value)} placeholder={keys?.gemini ? '•••••••• enregistrée (saisir pour remplacer)' : 'AIza…'} />
              <button className="btn" disabled={!gemini.trim()} onClick={() => void saveKey('gemini', gemini).then(() => setGemini(''))}>
                Enregistrer
              </button>
            </div>
            <span className="hint">{keys && !keys.chiffrement ? 'Chiffrement système indisponible : clé stockée en clair dans le dossier de l’application.' : 'Chiffrée par le système. Clé gratuite sur aistudio.google.com.'}</span>
          </label>
          <div className="row">
            <button
              className="btn sm"
              disabled={!!busy || !keys?.gemini}
              onClick={async () => {
                setBusy('gemini')
                setTest(await window.autobuild.testKeys())
                setBusy(undefined)
              }}
            >
              {busy === 'gemini' ? 'Test…' : 'Tester la clé'}
            </button>
            {test?.gemini && <span className="small">{test.gemini}</span>}
          </div>
        </div>
      </Card>
      <details className="card" style={{ padding: '14px 20px' }}>
        <summary className="strong" style={{ cursor: 'pointer' }}>
          Réglages avancés
        </summary>
        <div className="stack" style={{ marginTop: 14, gap: 14 }}>
          <div className="grid2">
            <label className="field">
              Brief rempli par
              <select className="input" value={s.briefProvider} onChange={(e) => setS({ ...s, briefProvider: e.target.value as Settings['briefProvider'] })}>
                <option value="claude">Claude</option>
                <option value="gemini">Gemini</option>
              </select>
            </label>
            <label className="field">
              Mise à jour du brief (secondes)
              <input className="input" type="number" min={10} max={120} value={s.briefIntervalSec} onChange={(e) => setS({ ...s, briefIntervalSec: Number(e.target.value) || 25 })} />
            </label>
            <label className="field">
              Modèle Claude (brief)
              <input className="input" value={s.models.claudeBrief} onChange={(e) => model('claudeBrief', e.target.value)} />
            </label>
            <label className="field">
              Modèle Claude (maquette)
              <input className="input" value={s.models.claudeGenerator} onChange={(e) => model('claudeGenerator', e.target.value)} />
            </label>
            <label className="field">
              Modèle Gemini (tronçons)
              <input className="input" value={s.models.geminiTranscription} onChange={(e) => model('geminiTranscription', e.target.value)} list="gemini-models" />
            </label>
            <label className="field">
              Modèle Gemini (continu)
              <input className="input" value={s.models.geminiLive} onChange={(e) => model('geminiLive', e.target.value)} list="gemini-live-models" />
            </label>
            <label className="field">
              Modèle Gemini (brief)
              <input className="input" value={s.models.geminiBrief} onChange={(e) => model('geminiBrief', e.target.value)} list="gemini-models" />
            </label>
            <label className="field">
              Durée max d’une étape de maquette (min)
              <input className="input" type="number" min={1} max={15} value={s.generation.maxAgentMinutes} onChange={(e) => setS({ ...s, generation: { ...s.generation, maxAgentMinutes: Number(e.target.value) || 4 } })} />
            </label>
            <label className="field">
              Effort (maquette)
              <select className="input" value={s.generatorEffort} onChange={(e) => setS({ ...s, generatorEffort: e.target.value as Settings['generatorEffort'] })}>
                <option value="low">Rapide</option>
                <option value="medium">Équilibré</option>
                <option value="high">Soigné (plus lent)</option>
              </select>
            </label>
            <label className="field">
              Effort (brief)
              <select className="input" value={s.briefEffort} onChange={(e) => setS({ ...s, briefEffort: e.target.value as Settings['briefEffort'] })}>
                <option value="low">Rapide</option>
                <option value="medium">Équilibré</option>
                <option value="high">Soigné (plus lent)</option>
              </select>
            </label>
          </div>
          <label className="check">
            <input type="checkbox" checked={s.generation.agentEnabled} onChange={(e) => setS({ ...s, generation: { ...s.generation, agentEnabled: e.target.checked } })} />
            <span>L’IA modifie le code de la maquette pendant l’appel (sinon : maquette de base uniquement)</span>
          </label>
        </div>
        <datalist id="gemini-models">
          <option value="gemini-3.8-flash" />
          <option value="gemini-3.5-transcribe" />
          <option value="gemini-3.6-flash" />
        </datalist>
        <datalist id="gemini-live-models">
          <option value="gemini-3.8-live" />
          <option value="gemini-3.5-transcribe-live" />
        </datalist>
      </details>
    </>
  )
}

function Agenda() {
  return (
    <>
      <Head titre="Agenda" texte="Synchronisation avec Outlook ou Google Agenda." />
      <Card>
        <div className="row" style={{ padding: 20, gap: 14, alignItems: 'flex-start' }}>
          <Icon name="calendar" style={{ color: 'var(--ink-3)', marginTop: 2 }} />
          <div>
            <b>Pas de synchronisation pour le moment</b>
            <p className="small muted" style={{ marginTop: 4 }}>
              Créez vos rendez-vous dans AutoBuild (bouton « Nouveau rendez-vous ») en collant le lien de la visio : ils sont préparés à l’avance et listés dans l’accueil et le calendrier.
            </p>
          </div>
        </div>
      </Card>
    </>
  )
}
