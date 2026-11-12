// Rendez-vous passé : synthèse, brief détaillé, transcription, maquette (pages et versions).
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatTime } from '@shared/brief/prompt'
import { type FieldDef, GROUPS, allFields, isExtra, progress } from '@shared/brief/schema'
import type { MaquettePage, Rdv } from '@shared/types'
import { prospectOf, useApp } from '../lib/data'
import { dateCourte, dateLongue, dureeMin, heure, pluriel, typeLabel } from '../lib/format'
import { type Route, go, href } from '../lib/router'
import { Page } from '../shell/Shell'
import { Icon } from '../ui/icons'
import { Card, Empty, Logo, cx } from '../ui/kit'

type Tab = 'synthese' | 'brief' | 'transcription' | 'maquette'

export function RdvPasse({ rdv, route, onReprise }: { rdv: Rdv; route: Extract<Route, { page: 'rdv' }>; onReprise: () => void }) {
  const { data, toast } = useApp()
  const p = prospectOf(data, rdv)
  const tab: Tab = route.tab ?? 'synthese'
  const pct = progress(rdv.brief).pct
  const duree = dureeMin(rdv)
  const [pages, setPages] = useState<MaquettePage[]>([])
  useEffect(() => void window.autobuild.maquettePages(rdv.id).then(setPages), [rdv.id, rdv.maquette.lastGood])
  const interlocuteurs = rdv.interlocuteurs.map((c) => `${c.nom}${c.fonction ? ` (${c.fonction})` : ''}`).join(' et ')
  const present = () => void window.autobuild.presentMaquette(rdv.id).catch((e: Error) => toast(e.message, true))
  const tabs: { id: Tab; label: string; n?: string }[] = [
    { id: 'synthese', label: 'Synthèse' },
    { id: 'brief', label: 'Brief', n: `${pct} %` },
    { id: 'transcription', label: 'Transcription', n: duree ? `${duree} min` : pluriel(rdv.transcript.length, 'échange') },
    { id: 'maquette', label: 'Maquette', n: pages.length ? pluriel(pages.length, 'page') : undefined }
  ]

  return (
    <>
      <section className="card" style={{ borderRadius: 0, borderWidth: '0 0 1px 0', padding: '22px 32px 0' }} aria-label={`Rendez-vous ${p?.nom}`}>
        <div className="row wrap" style={{ justifyContent: 'space-between', gap: 20, alignItems: 'center' }}>
          <div className="row" style={{ gap: 16, minWidth: 0 }}>
            <Logo nom={p?.nom ?? '?'} brand={rdv.brand ?? p?.brand} size={52} />
            <div style={{ minWidth: 0 }}>
              <div className="row wrap" style={{ gap: 10 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700 }}>
                  {p?.nom} · {rdv.titre.toLowerCase()}
                </h1>
                <span className="badge ok">{rdv.maquette.versions.some((v) => v.label.startsWith('Version montrée')) ? 'Maquette montrée' : 'Terminé'}</span>
                {rdv.scenarioId && <span className="badge wip">Démonstration</span>}
              </div>
              <p className="muted" style={{ marginTop: 4 }}>
                {dateCourte(rdv.startedAt ?? rdv.debut)} {new Date(rdv.startedAt ?? rdv.debut).getFullYear()}, {heure(rdv.startedAt ?? rdv.debut)}
                {duree ? ` · ${duree} min` : ''} · {typeLabel(rdv)}
                {interlocuteurs ? ` · avec ${interlocuteurs}` : ''}
              </p>
            </div>
          </div>
          <div className="row">
            <a className="btn" href={href({ page: 'rdv', id: rdv.id, tab: 'synthese' })} onClick={() => setTimeout(() => document.getElementById('compte-rendu')?.scrollIntoView({ behavior: 'smooth' }), 50)}>
              <Icon name="file" size={16} /> Compte rendu
            </a>
            <button className="btn" onClick={onReprise}>
              <Icon name="calendar" size={16} /> Planifier la suite
            </button>
            <button className="btn primary" onClick={present} disabled={!rdv.maquette.workspace}>
              <Icon name="present" size={16} /> Présenter la maquette
            </button>
          </div>
        </div>
        <nav className="tabs" aria-label="Sections du rendez-vous" style={{ marginTop: 18, borderBottom: 0 }}>
          {tabs.map((t) => (
            <a key={t.id} className={cx('tab', tab === t.id && 'on')} href={href({ page: 'rdv', id: rdv.id, tab: t.id })} aria-current={tab === t.id ? 'page' : undefined}>
              {t.label}
              {t.n && <span className="n">{t.n}</span>}
            </a>
          ))}
        </nav>
      </section>
      {tab === 'synthese' && <Synthese rdv={rdv} pages={pages} onReprise={onReprise} present={present} />}
      {tab === 'brief' && <BriefTab rdv={rdv} focus={route.focus} />}
      {tab === 'transcription' && <TranscriptionTab rdv={rdv} focus={route.focus} />}
      {tab === 'maquette' && <MaquetteTab rdv={rdv} pages={pages} present={present} onReprise={onReprise} />}
    </>
  )
}

function valeur(rdv: Rdv, id: string): string | undefined {
  const c = rdv.brief.champs[id]
  if (!c || c.status === 'manquant') return undefined
  return c.valeur ?? c.items?.map((i) => i.nom).join(', ')
}

// ── Synthèse ───────────────────────────────────────────────────
function Synthese({ rdv, pages, onReprise, present }: { rdv: Rdv; pages: MaquettePage[]; onReprise: () => void; present: () => void }) {
  const { toast } = useApp()
  const fields = allFields(rdv.brief)
  const pr = progress(rdv.brief)
  const ajoutees = rdv.brief.champsAjoutes.length
  const manquants = fields.filter((f) => rdv.brief.champs[f.id]?.status === 'manquant').sort((a, b) => a.priorite - b.priorite)
  const cles = ['budget', 'delai', 'decideurs', 'concurrence', 'criteres'].map((id) => ({ f: fields.find((x) => x.id === id)!, v: valeur(rdv, id) }))
  const suite = valeur(rdv, 'prochaine_etape')
  const duree = dureeMin(rdv)
  const exporter = async (kind: 'pdf' | 'md' | 'email') => {
    try {
      if (kind === 'email') {
        await navigator.clipboard.writeText(await window.autobuild.emailText(rdv.id))
        toast('Texte de l’e-mail copié : collez-le dans votre messagerie.')
      } else {
        const file = kind === 'pdf' ? await window.autobuild.exportPdf(rdv.id) : await window.autobuild.exportMarkdown(rdv.id)
        toast(`Enregistré : ${file.split(/[\\/]/).pop()}`)
      }
    } catch (err) {
      toast((err as Error).message, true)
    }
  }
  return (
    <Page>
      <div className="split">
        <div className="main">
          <Card title="Le besoin en bref">
            <div style={{ padding: '14px 20px 20px' }} className="stack">
              <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink-2)' }}>{rdv.brief.resume || 'Pas de résumé : le brief n’a pas été rempli pendant ce rendez-vous.'}</p>
              <div className="grid2" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                {[
                  { l: 'Brief', v: `${pr.pct} %`, s: `${pr.obtenu + pr.partiel} infos sur ${pr.total}`, to: href({ page: 'rdv', id: rdv.id, tab: 'brief' }) },
                  { l: 'Ajoutées en cours', v: String(ajoutees), s: 'propres au projet', to: href({ page: 'rdv', id: rdv.id, tab: 'brief' }) },
                  { l: 'Durée', v: duree ? `${duree} min` : '—', s: pluriel(rdv.transcript.length, 'échange'), to: href({ page: 'rdv', id: rdv.id, tab: 'transcription' }) },
                  { l: 'Maquette', v: pluriel(pages.length, 'page'), s: pluriel(rdv.maquette.versions.length, 'version'), to: href({ page: 'rdv', id: rdv.id, tab: 'maquette' }) }
                ].map((c) => (
                  <a key={c.l} href={c.to} className="stat" style={{ display: 'block' }}>
                    <span className="xs muted" style={{ display: 'block' }}>
                      {c.l}
                    </span>
                    <span style={{ display: 'block', fontSize: 22, fontWeight: 700, marginTop: 2 }}>{c.v}</span>
                    <span className="xs muted">{c.s}</span>
                  </a>
                ))}
              </div>
            </div>
          </Card>
          <Card title="Qualification" action={<a className="link" href={href({ page: 'rdv', id: rdv.id, tab: 'brief' })}>Brief complet</a>}>
            {cles.map(({ f, v }) => (
              <a key={f.id} href={href({ page: 'rdv', id: rdv.id, tab: 'brief', focus: f.id })} className="rowlink">
                <span style={{ width: 170, flexShrink: 0 }} className="small muted">
                  {f.label}
                </span>
                <span style={{ flex: 1, fontWeight: v ? 600 : 400, color: v ? 'var(--ink)' : 'var(--warn)' }}>{v ?? 'Non obtenu'}</span>
                <Icon name="chevron" size={16} style={{ color: 'var(--ink-4)' }} />
              </a>
            ))}
          </Card>
          <Card title={<>À creuser au prochain rendez-vous <span className="small muted" style={{ fontWeight: 500 }}>· {pluriel(manquants.length, 'info manquante', 'infos manquantes')}</span></>}>
            <div style={{ padding: '14px 20px 18px' }} className="stack">
              {manquants.length === 0 ? (
                <p className="small muted">Tout est obtenu. 🎉</p>
              ) : (
                <div className="chips">
                  {manquants.slice(0, 14).map((f) => (
                    <a key={f.id} className="chip" href={href({ page: 'rdv', id: rdv.id, tab: 'brief', focus: f.id })} style={{ fontWeight: f.priorite === 1 ? 600 : 500 }}>
                      <span className="dot" style={{ border: '1.5px solid var(--ink-4)', marginRight: 6, width: 8, height: 8 }} />
                      {f.label}
                    </a>
                  ))}
                </div>
              )}
              <p className="xs muted">Planifiez la suite depuis ce rendez-vous : le brief est repris, et ces infos restent à obtenir dans la checklist.</p>
            </div>
          </Card>
        </div>
        <aside className="side">
          <section className="card" style={{ padding: 20, background: 'var(--dark)', color: '#fff', borderColor: 'var(--dark)' }} aria-label="Prochaine étape">
            <span className="kicker" style={{ color: '#a5b4fc' }}>
              Prochaine étape convenue
            </span>
            <p style={{ marginTop: 8, lineHeight: 1.5 }}>{suite ?? 'Pas de suite convenue pendant l’appel.'}</p>
            <button className="btn" style={{ marginTop: 14, width: '100%' }} onClick={onReprise}>
              Planifier le rendez-vous suivant
            </button>
          </section>
          <Card title="Maquette" action={<a className="link" href={href({ page: 'rdv', id: rdv.id, tab: 'maquette' })}>Pages et versions</a>}>
            <div style={{ padding: 20 }} className="stack">
              <p className="small muted">
                {pluriel(pages.length, 'page')} · {pluriel(rdv.maquette.versions.length, 'version')}
                {rdv.maquette.templateName ? ` · ${rdv.maquette.templateName}` : ''}
              </p>
              <button className="btn primary" onClick={present} disabled={!rdv.maquette.workspace}>
                <Icon name="present" size={16} /> Présenter
              </button>
            </div>
          </Card>
          <Card title="Compte rendu" className="" bodyClass="">
            <div id="compte-rendu" style={{ padding: 20 }} className="stack">
              <p className="small muted">Résumé, besoin, qualification et infos à obtenir, prêts à envoyer au prospect ou à coller dans le CRM.</p>
              <div className="row wrap">
                <button className="btn sm" onClick={() => void exporter('pdf')}>
                  <Icon name="download" size={14} /> PDF
                </button>
                <button className="btn sm" onClick={() => void exporter('email')}>
                  <Icon name="mail" size={14} /> Copier pour un e-mail
                </button>
                <button className="btn sm" onClick={() => void exporter('md')}>
                  <Icon name="file" size={14} /> Markdown
                </button>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </Page>
  )
}

// ── Brief détaillé ─────────────────────────────────────────────
type Filtre = 'toutes' | 'manquantes' | 'ajoutees' | 'maquette' | 'commercial'

function BriefTab({ rdv, focus }: { rdv: Rdv; focus?: string }) {
  const [filtre, setFiltre] = useState<Filtre>('toutes')
  const fields = allFields(rdv.brief)
  const st = (f: FieldDef) => rdv.brief.champs[f.id]?.status ?? 'manquant'
  const counts = {
    manquantes: fields.filter((f) => st(f) === 'manquant').length,
    ajoutees: rdv.brief.champsAjoutes.length
  }
  const keep = (f: FieldDef) =>
    filtre === 'toutes' ? true : filtre === 'manquantes' ? st(f) === 'manquant' : filtre === 'ajoutees' ? !!isExtra(f.id, rdv.brief) : filtre === 'maquette' ? f.maquette : f.groupe === 'commercial'
  const sel = focus ? fields.find((f) => f.id === focus) : undefined
  return (
    <div className="with-drawer">
      <Page>
        <div className="row wrap" style={{ gap: 8 }}>
          {(
            [
              ['toutes', 'Toutes'],
              ['manquantes', `Manquantes · ${counts.manquantes}`],
              ['ajoutees', `Ajoutées en cours · ${counts.ajoutees}`],
              ['maquette', 'Pour la maquette'],
              ['commercial', 'Commercial']
            ] as const
          ).map(([id, l]) => (
            <button key={id} className={cx('chip', filtre === id && 'on')} aria-pressed={filtre === id} onClick={() => setFiltre(id)}>
              {l}
            </button>
          ))}
          <span className="spacer" />
          <span className="small muted">
            {fields.length - counts.manquantes} obtenues · {counts.manquantes} manquantes
          </span>
        </div>
        {GROUPS.map((g) => {
          const gf = fields.filter((f) => f.groupe === g.id)
          const shown = gf.filter(keep)
          if (!shown.length) return null
          const n = gf.filter((f) => st(f) !== 'manquant').length
          return (
            <section key={g.id} className="card">
              <h2 className="card-head" style={{ fontSize: 14 }}>
                <span>{g.label}</span>
                <span className="small muted tabular">
                  {n}/{gf.length}
                </span>
              </h2>
              {shown.map((f) => {
                const c = rdv.brief.champs[f.id]
                const manquant = st(f) === 'manquant'
                const extra = isExtra(f.id, rdv.brief)
                const pr = c?.preuves[0]
                const seg = pr?.source === 'transcript' ? rdv.transcript.find((s) => s.id === pr.segmentId) : undefined
                return (
                  <a
                    key={f.id}
                    href={href({ page: 'rdv', id: rdv.id, tab: 'brief', focus: f.id })}
                    className="rowlink"
                    aria-current={sel?.id === f.id ? 'true' : undefined}
                    style={sel?.id === f.id ? { background: 'var(--accent-soft)', boxShadow: 'inset 3px 0 0 var(--accent)' } : undefined}
                  >
                    <span style={{ width: 18, height: 18, borderRadius: 99, flexShrink: 0, display: 'grid', placeItems: 'center', ...(manquant ? { border: '1.5px solid var(--ink-4)' } : { background: 'var(--ok-strong)', color: '#fff' }) }}>
                      {!manquant && <Icon name="check" size={11} stroke={3} />}
                    </span>
                    <span style={{ width: 190, flexShrink: 0, color: manquant ? 'var(--ink-3)' : undefined, fontWeight: 500 }}>{f.label}</span>
                    <span className="ellipsis" style={{ flex: 1, color: manquant ? 'var(--ink-4)' : 'var(--ink-2)' }}>
                      {manquant ? 'Non précisé' : (c.valeur ?? c.items?.map((i) => i.nom).join(', '))}
                      {c?.status === 'partiel' && <span className="xs muted"> (partiel)</span>}
                    </span>
                    {extra && <span className="tag ia">{extra.origine === 'ia' ? 'IA' : 'Projet'}</span>}
                    <span className={cx('badge', manquant ? 'todo' : '')}>{manquant ? 'Manquant' : seg ? formatTime(seg.startMs) : pr?.source === 'site' ? 'Site web' : pr?.source === 'saisie' ? 'Saisi' : '—'}</span>
                  </a>
                )
              })}
            </section>
          )
        })}
      </Page>
      {sel && <BriefDetail rdv={rdv} f={sel} />}
    </div>
  )
}

function BriefDetail({ rdv, f }: { rdv: Rdv; f: FieldDef }) {
  const { toast } = useApp()
  const c = rdv.brief.champs[f.id]
  const manquant = !c || c.status === 'manquant'
  const [edit, setEdit] = useState(false)
  const [v, setV] = useState(c?.valeur ?? '')
  useEffect(() => {
    setEdit(false)
    setV(c?.valeur ?? '')
  }, [f.id])
  const extra = isExtra(f.id, rdv.brief)
  const close = () => go({ page: 'rdv', id: rdv.id, tab: 'brief' })
  return (
    <aside className="drawer" aria-label={`Détail : ${f.label}`} style={{ position: 'sticky', top: 0, alignSelf: 'flex-start', height: 'calc(100vh - 72px)' }}>
      <div className="sheet-head">
        <div>
          <p className="xs muted">{GROUPS.find((g) => g.id === f.groupe)?.label}</p>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{f.label}</h2>
        </div>
        <button className="iconbtn" aria-label="Fermer le détail" onClick={close}>
          <Icon name="x" />
        </button>
      </div>
      <div className="sheet-body" style={{ flex: 1 }}>
        <div className="stack" style={{ gap: 8 }}>
          <span className={cx('badge', manquant ? 'todo' : c.status === 'partiel' ? 'wip' : 'ok')} style={{ alignSelf: 'flex-start' }}>
            {manquant ? 'Manquant' : c.status === 'partiel' ? 'Partiel' : 'Obtenu'}
          </span>
          {edit ? (
            <>
              <textarea className="input" rows={4} value={v} onChange={(e) => setV(e.target.value)} autoFocus />
              <div className="row">
                <button className="btn sm ghost" onClick={() => setEdit(false)}>
                  Annuler
                </button>
                <button
                  className="btn sm primary"
                  onClick={async () => {
                    await window.autobuild.setManual(rdv.id, f.id, v)
                    setEdit(false)
                    toast('Brief mis à jour.')
                  }}
                >
                  Enregistrer
                </button>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 15, lineHeight: 1.5 }}>{manquant ? <span className="muted">{f.description}</span> : c.valeur}</p>
          )}
          {!manquant && c.items && c.items.length > 0 && (
            <ul className="stack" style={{ gap: 6, marginTop: 4 }}>
              {c.items.map((i) => (
                <li key={i.nom} className="small">
                  <b>{i.nom}</b>
                  {i.details ? ` — ${i.details}` : ''}
                  {i.attributs?.length ? <span className="muted"> ({i.attributs.join(', ')})</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        {!manquant && c.preuves.length > 0 && (
          <div className="stack" style={{ gap: 10 }}>
            <h3 className="section-title">Ce qui a été dit</h3>
            {c.preuves.map((p, i) => {
              if (p.source !== 'transcript') return <p key={i} className="small muted">{p.source === 'site' ? `D’après le site web : « ${p.citation} »` : 'Saisi par le commercial'}</p>
              const seg = rdv.transcript.find((s) => s.id === p.segmentId)
              return (
                <a key={i} href={href({ page: 'rdv', id: rdv.id, tab: 'transcription', focus: p.segmentId })} style={{ display: 'block', padding: '10px 12px', borderRadius: 10, background: 'var(--soft)', border: '1px solid var(--line)' }}>
                  <span className="xs muted" style={{ display: 'block' }}>
                    {seg ? `${seg.speaker === 'prospect' ? 'Prospect' : 'Commercial'} · ${formatTime(seg.startMs)}` : p.segmentId}
                  </span>
                  <span className="small" style={{ display: 'block', margin: '4px 0' }}>
                    « {p.citation} »
                  </span>
                  <span className="link xs">Voir dans la transcription</span>
                </a>
              )
            })}
          </div>
        )}
        <div className="stack" style={{ gap: 6 }}>
          <h3 className="section-title">Historique</h3>
          {extra && <p className="small">Ajoutée à la checklist {extra.origine === 'ia' ? 'par l’IA' : 'pour ce type de projet'}{extra.ajouteLe ? ` à ${heure(extra.ajouteLe)}` : ''}</p>}
          {!manquant && c.majLe ? <p className="small">Mise à jour le {dateLongue(c.majLe)} à {heure(c.majLe)}</p> : <p className="small muted">Pas encore obtenue.</p>}
        </div>
      </div>
      {!edit && (
        <div className="sheet-foot">
          <button className="btn sm" onClick={() => setEdit(true)}>
            <Icon name="edit" size={14} /> {manquant ? 'Compléter' : 'Modifier'}
          </button>
        </div>
      )}
    </aside>
  )
}

// ── Transcription ──────────────────────────────────────────────
function TranscriptionTab({ rdv, focus }: { rdv: Rdv; focus?: string }) {
  const { settings, toast } = useApp()
  const [q, setQ] = useState('')
  const [qui, setQui] = useState<'tous' | 'commercial' | 'prospect'>('tous')
  const focused = useRef<HTMLLIElement>(null)
  useEffect(() => {
    focused.current?.scrollIntoView({ block: 'center' })
  }, [focus])
  const fields = allFields(rdv.brief)
  // Segment → infos du brief dont il est la preuve.
  const infos = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const f of fields) for (const p of rdv.brief.champs[f.id]?.preuves ?? []) if (p.source === 'transcript') m.set(p.segmentId, [...(m.get(p.segmentId) ?? []), f.id])
    return m
  }, [rdv.brief])
  const moments = useMemo(() => {
    const out: { segId: string; t: number; label: string }[] = []
    for (const f of fields) {
      const p = rdv.brief.champs[f.id]?.preuves.find((x) => x.source === 'transcript')
      const seg = p?.source === 'transcript' ? rdv.transcript.find((s) => s.id === p.segmentId) : undefined
      if (seg) out.push({ segId: seg.id, t: seg.startMs, label: f.label })
    }
    return out.sort((a, b) => a.t - b.t)
  }, [rdv.brief])
  const lignes = rdv.transcript.filter((s) => (qui === 'tous' || s.speaker === qui) && (!q || s.text.toLowerCase().includes(q.toLowerCase())))
  const nb = q ? rdv.transcript.filter((s) => s.text.toLowerCase().includes(q.toLowerCase())).length : 0
  if (!rdv.transcript.length) return <Page><div className="card"><Empty icon="mic" title="Pas de transcription" text="Ce rendez-vous n’a pas été enregistré." /></div></Page>
  return (
    <Page>
      <div className="split">
        <div className="main">
          <div className="row wrap" style={{ gap: 12 }}>
            <label className="search" style={{ flex: '1 1 260px', maxWidth: 420 }}>
              <Icon name="search" size={16} />
              <input aria-label="Rechercher dans la transcription" placeholder="Rechercher dans la transcription" value={q} onChange={(e) => setQ(e.target.value)} style={{ border: 0, background: 'transparent', outline: 'none', flex: 1 }} />
              {q && <span className="xs muted">{pluriel(nb, 'résultat')}</span>}
            </label>
            <div className="seg" role="group" aria-label="Interlocuteur">
              {(
                [
                  ['tous', 'Tous'],
                  ['commercial', 'Vous'],
                  ['prospect', 'Prospect']
                ] as const
              ).map(([id, l]) => (
                <button key={id} className={cx(qui === id && 'on')} aria-pressed={qui === id} onClick={() => setQui(id)}>
                  {l}
                </button>
              ))}
            </div>
            <span className="spacer" />
            <button className="btn sm" onClick={() => void window.autobuild.exportMarkdown(rdv.id).then((f) => toast(`Enregistré : ${f.split(/[\\/]/).pop()}`))}>
              <Icon name="download" size={14} /> Télécharger
            </button>
          </div>
          <ol className="card" style={{ padding: '6px 0' }}>
            {lignes.map((s) => {
              const ids = infos.get(s.id) ?? []
              const isFocus = focus === s.id
              return (
                <li key={s.id} ref={isFocus ? focused : undefined} style={{ display: 'flex', gap: 16, padding: '12px 20px', borderBottom: '1px solid var(--line-3)', ...(isFocus ? { background: '#fefce8', boxShadow: 'inset 3px 0 0 #eab308' } : {}) }}>
                  <span className="xs muted tabular" style={{ width: 44, paddingTop: 2 }}>
                    {formatTime(s.startMs)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="small strong" style={{ color: s.speaker === 'commercial' ? 'var(--accent-link)' : 'var(--ink)' }}>
                      {s.speaker === 'commercial' ? settings.profil.nom || 'Vous' : rdv.interlocuteurs.length === 1 ? rdv.interlocuteurs[0].nom : 'Prospect'}
                    </p>
                    <p style={{ marginTop: 2, lineHeight: 1.55 }}>{surligner(s.text, q)}</p>
                    {ids.length > 0 && (
                      <div className="row wrap" style={{ gap: 6, marginTop: 6 }}>
                        {ids.map((id) => (
                          <a key={id} className="badge wip" href={href({ page: 'rdv', id: rdv.id, tab: 'brief', focus: id })}>
                            Brief : {fields.find((f) => f.id === id)?.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
            {lignes.length === 0 && <li className="small muted" style={{ padding: 20 }}>Aucun passage ne correspond.</li>}
          </ol>
        </div>
        <aside className="side" style={{ position: 'sticky', top: 24 }}>
          <Card title="Moments clés">
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {moments.map((m) => (
                <a key={`${m.segId}-${m.label}`} className="rowlink" style={{ padding: '9px 20px' }} href={href({ page: 'rdv', id: rdv.id, tab: 'transcription', focus: m.segId })}>
                  <span className="xs muted tabular" style={{ width: 40 }}>
                    {formatTime(m.t)}
                  </span>
                  <span className="small">{m.label}</span>
                </a>
              ))}
              {moments.length === 0 && <p className="small muted" style={{ padding: '14px 20px' }}>Aucune info du brief n’a été tirée de cet échange.</p>}
            </div>
          </Card>
        </aside>
      </div>
    </Page>
  )
}

function surligner(text: string, q: string): React.ReactNode {
  if (!q) return text
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {surligner(text.slice(i + q.length), q)}
    </>
  )
}

// ── Maquette ───────────────────────────────────────────────────
const ORIGINES: Record<MaquettePage['origine'], string> = {
  'tableau-de-bord': 'Tableau de bord',
  entite: 'Liste et fiches, champs du prospect',
  bibliotheque: 'Page de la bibliothèque, adaptée',
  'sur-mesure': 'Créée sur mesure par l’IA'
}

function MaquetteTab({ rdv, pages, present, onReprise }: { rdv: Rdv; pages: MaquettePage[]; present: () => void; onReprise: () => void }) {
  const { toast, live } = useApp()
  const [url, setUrl] = useState<string>()
  const [err, setErr] = useState<string>()
  const [pageId, setPageId] = useState<string>()
  const [nonce, setNonce] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.6)
  useEffect(() => {
    setErr(undefined)
    window.autobuild
      .viewMaquette(rdv.id)
      .then(setUrl)
      .catch((e: Error) => setErr(e.message))
  }, [rdv.id])
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 1440))
    ro.observe(el)
    return () => ro.disconnect()
  }, [url])
  const current = pageId ?? pages[0]?.id
  const versions = [...rdv.maquette.versions].reverse()
  const actuelle = rdv.maquette.lastGood ?? versions[0]?.id
  const restore = async (id: string, label: string) => {
    try {
      await window.autobuild.restoreVersion(rdv.id, id)
      setNonce(nonce + 1)
      toast(`Version « ${label} » restaurée.`)
    } catch (e) {
      toast((e as Error).message, true)
    }
  }
  return (
    <Page wide>
      <div style={{ display: 'grid', gridTemplateColumns: '240px minmax(0, 1fr) 300px', gap: 24, alignItems: 'start' }}>
        <nav aria-label="Pages de la maquette" className="card" style={{ padding: 8 }}>
          <p className="section-title" style={{ padding: '8px 10px' }}>
            Pages · {pages.length}
          </p>
          {pages.map((p) => (
            <button key={p.id} className={cx('nav-item', current === p.id && 'on')} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 1 }} onClick={() => setPageId(p.id)} aria-current={current === p.id ? 'page' : undefined}>
              <span style={{ fontWeight: 600 }}>{p.label}</span>
              <span className="xs muted" style={{ fontWeight: 400 }}>
                {ORIGINES[p.origine]}
              </span>
            </button>
          ))}
          {pages.length === 0 && <p className="small muted" style={{ padding: 10 }}>Maquette introuvable sur ce poste.</p>}
        </nav>
        <main className="stack" style={{ gap: 14 }}>
          <div className="row wrap" style={{ justifyContent: 'space-between' }}>
            <div>
              <h2 className="h2">{pages.find((p) => p.id === current)?.label ?? 'Maquette'}</h2>
              <p className="small muted">{rdv.maquette.templateName ? `Template ${rdv.maquette.templateName}` : ''}</p>
            </div>
            <div className="row">
              <button className="btn sm primary" onClick={present}>
                <Icon name="present" size={14} /> Présenter
              </button>
              <button className="btn sm" onClick={() => void window.autobuild.openMaquetteFolder(rdv.id)}>
                <Icon name="folder" size={14} /> Ouvrir le dossier
              </button>
            </div>
          </div>
          <div ref={box} className="preview-frame" style={{ width: '100%', height: 900 * scale }}>
            {url ? (
              <iframe key={`${current}-${nonce}`} title="Aperçu de la maquette" src={`${url}?apercu=1#/${current ?? ''}`} style={{ width: 1440, height: 900, transform: `scale(${scale})` }} />
            ) : (
              <div className="empty" style={{ height: '100%', justifyContent: 'center' }}>
                {err ? <span className="small">{err}</span> : <span className="spinner" />}
              </div>
            )}
          </div>
          <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={onReprise}>
            <Icon name="copy" size={15} /> Reprendre cette maquette pour le rendez-vous suivant
          </button>
        </main>
        <aside className="card" aria-label="Versions">
          <div className="card-head">
            <h2>Versions · {versions.length}</h2>
          </div>
          <ol style={{ padding: '6px 0' }}>
            {versions.map((v, i) => (
              <li key={v.id} className="rowlink" style={{ alignItems: 'flex-start', padding: '11px 18px' }}>
                <span className="dot" style={{ marginTop: 6, background: v.id === actuelle ? 'var(--accent)' : i === versions.length - 1 ? 'var(--ok-strong)' : '#d1d5db' }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="small strong" style={{ display: 'block' }}>
                    v{versions.length - i} · {v.label}
                  </span>
                  <span className="xs muted">{heure(v.at)}</span>
                </span>
                {v.id === actuelle ? (
                  <span className="xs muted">Actuelle</span>
                ) : (
                  <button className="link xs" disabled={live.rdvId === rdv.id && live.phase === 'ecoute'} onClick={() => void restore(v.id, v.label)}>
                    Restaurer
                  </button>
                )}
              </li>
            ))}
          </ol>
          {rdv.maquette.steps.some((s) => s.status === 'echec') && (
            <p className="xs muted" style={{ padding: '0 18px 14px' }}>
              {pluriel(rdv.maquette.steps.filter((s) => s.status === 'echec').length, 'étape annulée')} (la maquette ne compilait plus : retour automatique à la version précédente).
            </p>
          )}
        </aside>
      </div>
    </Page>
  )
}
