// Accueil : prochain rendez-vous, la semaine, les choses à faire, les derniers rendez-vous.
import { progress } from '@shared/brief/schema'
import type { Rdv } from '@shared/types'
import { past, prospectOf, upcoming, useApp } from '../lib/data'
import { CONTEXTES, cap, dateCourte, dateLongue, heure, jour, pluriel, relatif, startOfDay, typeLabel } from '../lib/format'
import { href } from '../lib/router'
import { Page } from '../shell/Shell'
import { Icon } from '../ui/icons'
import { Card, Empty, Logo, StatutBadge, StepIcon } from '../ui/kit'

export function Accueil({ onStart, onNew, onDemo }: { onStart: (id: string) => void; onNew: () => void; onDemo: () => void }) {
  const { data, settings, keys } = useApp()
  const prenom = settings.profil.nom.split(' ')[0]
  const today = startOfDay(Date.now())
  const avenir = upcoming(data)
  const aujourdhui = data.rdvs.filter((r) => startOfDay(new Date(r.debut)) === today)
  const next = avenir.find((r) => Date.parse(r.debut) + r.dureeMin * 60_000 > Date.now()) ?? avenir[0]
  const passes = past(data)

  if (data.rdvs.length === 0) return <Bienvenue onNew={onNew} onDemo={onDemo} />

  // La semaine : aujourd'hui et les 6 jours suivants (RDV passés du jour compris).
  const semaine: { jour: number; rdvs: Rdv[] }[] = []
  for (let i = 0; i < 7; i++) {
    const d = today + i * 86_400_000
    const rdvs = data.rdvs.filter((r) => startOfDay(new Date(r.debut)) === d).sort((a, b) => a.debut.localeCompare(b.debut))
    if (rdvs.length) semaine.push({ jour: d, rdvs })
  }

  const todo = aFaire(data.rdvs, (r) => prospectOf(data, r)?.nom ?? '', (r) => !!prospectOf(data, r)?.siteUrl)
  const mois = data.rdvs.filter((r) => new Date(r.debut).getMonth() === new Date().getMonth() && new Date(r.debut).getFullYear() === new Date().getFullYear()).length
  const seconds = data.prospects.filter((p) => data.rdvs.filter((r) => r.prospectId === p.id).length > 1).length

  return (
    <Page>
      <div className="row wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>
        <div>
          <p className="small muted">{cap(dateLongue(Date.now()))}</p>
          <h1 className="h1" style={{ marginTop: 4 }}>
            Bonjour{prenom ? ` ${prenom}` : ''}, {aujourdhui.length ? `${pluriel(aujourdhui.length, 'rendez-vous', 'rendez-vous')} aujourd’hui` : 'pas de rendez-vous aujourd’hui'}
          </h1>
        </div>
        <button className="link" onClick={onDemo}>
          Faire un essai avec un faux rendez-vous
        </button>
      </div>
      {keys && (!keys.claude || !keys.gemini) && (
        <a href={href({ page: 'reglages', section: 'ia' })} className="card" style={{ padding: '14px 20px', display: 'flex', gap: 12, alignItems: 'center', borderColor: '#fed7aa', background: 'var(--warn-soft)' }}>
          <Icon name="key" style={{ color: 'var(--warn)' }} />
          <span style={{ flex: 1 }}>
            <b>Accès IA à terminer</b>
            <span className="small" style={{ display: 'block', color: 'var(--ink-2)' }}>
              {!keys.gemini ? 'Sans clé Gemini, la transcription d’un vrai rendez-vous est impossible. ' : ''}
              {!keys.claude ? 'Sans Claude, la maquette reste la version de base. ' : ''}La démonstration fonctionne sans.
            </span>
          </span>
          <Icon name="chevron" />
        </a>
      )}

      <div className="split">
        <div className="main">
          {next ? <ProchainRdv rdv={next} onStart={onStart} /> : <Card title="Prochain rendez-vous"><Empty icon="calendar" title="Aucun rendez-vous à venir" text="Planifiez-le à l’avance : la maquette de départ sera prête avant l’appel."><button className="btn primary" onClick={onNew}>Nouveau rendez-vous</button></Empty></Card>}
          <Card title="Cette semaine" action={<a className="link" href={href({ page: 'rdvs' })}>Tous les rendez-vous</a>}>
            {semaine.length === 0 && <p className="small muted" style={{ padding: '16px 20px' }}>Aucun rendez-vous dans les 7 prochains jours.</p>}
            {semaine.map((j) => (
              <div key={j.jour} style={{ display: 'flex', gap: 16, padding: '14px 24px', borderBottom: '1px solid var(--line-3)' }}>
                <div style={{ width: 84, flexShrink: 0, paddingTop: 2 }}>
                  <p className="xs" style={{ fontWeight: 700, textTransform: 'uppercase', color: j.jour === today ? 'var(--rec)' : 'var(--ink)' }}>
                    {jour(j.jour)}
                  </p>
                  <p className="xs muted" style={{ marginTop: 2 }}>
                    {dateCourte(j.jour)}
                  </p>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {j.rdvs.map((r) => {
                    const p = prospectOf(data, r)
                    return (
                      <a key={r.id} href={href({ page: 'rdv', id: r.id })} className="row" style={{ gap: 14 }}>
                        <span className="tabular" style={{ width: 46, fontWeight: 700 }}>
                          {heure(r.debut)}
                        </span>
                        <Logo nom={p?.nom ?? '?'} brand={r.brand ?? p?.brand} size={34} />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span className="ellipsis" style={{ display: 'block', fontWeight: 600 }}>
                            {p?.nom}
                            {r.titre !== 'Premier rendez-vous' ? ` · ${r.titre}` : ''}
                          </span>
                          <span className="small muted ellipsis" style={{ display: 'block' }}>
                            {[r.interlocuteurs[0] && `${r.interlocuteurs[0].nom}${r.interlocuteurs[0].fonction ? `, ${r.interlocuteurs[0].fonction}` : ''}`, typeLabel(r)].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <StatutBadge rdv={r} />
                      </a>
                    )
                  })}
                </div>
              </div>
            ))}
          </Card>
        </div>

        <aside className="side">
          <Card title={<>À faire {todo.length > 0 && <span className="small muted" style={{ fontWeight: 500 }}>· {todo.length}</span>}</>}>
            {todo.length === 0 && <p className="small muted" style={{ padding: '14px 20px' }}>Rien en attente. 👌</p>}
            {todo.map((t, i) => (
              <a key={i} href={t.to} className="rowlink" style={{ alignItems: 'flex-start' }}>
                <span className="dot" style={{ marginTop: 7, background: t.urgent ? 'var(--warn-strong)' : 'var(--accent)' }} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 600 }}>{t.titre}</span>
                  <span className="small muted" style={{ display: 'block', marginTop: 2 }}>
                    {t.detail}
                  </span>
                </span>
              </a>
            ))}
          </Card>
          <Card title="Derniers rendez-vous" action={passes.length > 0 && <a className="link" href={href({ page: 'rdvs', filtre: 'passes' })}>Historique</a>}>
            {passes.length === 0 && <p className="small muted" style={{ padding: '14px 20px' }}>Les rendez-vous terminés apparaîtront ici, avec leur brief, leur transcription et leur maquette.</p>}
            {passes.slice(0, 4).map((r) => {
              const p = prospectOf(data, r)
              return (
                <a key={r.id} href={href({ page: 'rdv', id: r.id })} className="rowlink">
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="ellipsis" style={{ display: 'block', fontWeight: 600 }}>
                      {p?.nom}
                    </span>
                    <span className="small muted ellipsis" style={{ display: 'block' }}>
                      {jour(r.startedAt ?? r.debut)} · {typeLabel(r)}
                    </span>
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--ok)' }}>{progress(r.brief).pct} %</span>
                    <span className="xs muted">brief</span>
                  </span>
                </a>
              )
            })}
          </Card>
          <section aria-label="Ce mois-ci" className="grid2" style={{ gap: 12 }}>
            <div className="stat">
              <p>RDV ce mois</p>
              <p>{mois}</p>
            </div>
            <div className="stat">
              <p>Seconds RDV obtenus</p>
              <p>{seconds}</p>
            </div>
          </section>
        </aside>
      </div>
    </Page>
  )
}

function ProchainRdv({ rdv, onStart }: { rdv: Rdv; onStart: (id: string) => void }) {
  const { data } = useApp()
  const p = prospectOf(data, rdv)
  const soon = Date.parse(rdv.debut) - Date.now() < 3 * 3600_000
  return (
    <section className="card" aria-label="Prochain rendez-vous">
      <div style={{ padding: '22px 24px', display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between' }}>
        <a href={href({ page: 'rdv', id: rdv.id })} className="row" style={{ gap: 16, minWidth: 0 }}>
          <Logo nom={p?.nom ?? '?'} brand={rdv.brand ?? p?.brand} size={56} />
          <div style={{ minWidth: 0 }}>
            <p className="kicker" style={{ color: soon ? 'var(--rec)' : 'var(--accent-ink)' }}>
              {cap(relatif(rdv.debut))} · {jour(rdv.debut)} {heure(rdv.debut)}
            </p>
            <h2 style={{ margin: '4px 0 2px', fontSize: 21, fontWeight: 700 }}>{p?.nom}</h2>
            <p className="muted">{[rdv.interlocuteurs[0] && `${rdv.interlocuteurs[0].nom}${rdv.interlocuteurs[0].fonction ? `, ${rdv.interlocuteurs[0].fonction}` : ''}`, rdv.titre, rdv.scenarioId ? 'Démonstration' : CONTEXTES[rdv.contexte]].filter(Boolean).join(' · ')}</p>
          </div>
        </a>
        <button className="btn rec lg" onClick={() => onStart(rdv.id)}>
          <span className="recdot" />
          Démarrer le rendez-vous
        </button>
      </div>
      <div className="card-foot">
        {rdv.preparation.etapes.map((e) => (
          <span key={e.id} className="row" style={{ gap: 6, fontWeight: 600, color: e.statut === 'ok' ? 'var(--ok)' : e.statut === 'echec' ? 'var(--err)' : 'var(--ink-3)' }}>
            {e.statut === 'ok' ? <Icon name="check" size={16} stroke={2.4} /> : e.statut === 'en_cours' ? <span className="spinner" /> : e.statut === 'echec' ? <Icon name="x" size={16} stroke={2.4} /> : <StepIcon etat="a_venir" />}
            {e.label}
          </span>
        ))}
        <span className="spacer" />
        <a className="link" href={href({ page: 'rdv', id: rdv.id })}>
          Voir la préparation
        </a>
      </div>
    </section>
  )
}

/** Tâches déduites des rendez-vous : compléter, relancer la préparation, planifier le R2, envoyer le compte rendu. */
function aFaire(rdvs: Rdv[], nom: (r: Rdv) => string, hasSite: (r: Rdv) => boolean): { titre: string; detail: string; to: string; urgent?: boolean }[] {
  const out: { titre: string; detail: string; to: string; urgent?: boolean }[] = []
  const now = Date.now()
  for (const r of rdvs.filter((x) => x.statut !== 'termine').sort((a, b) => a.debut.localeCompare(b.debut))) {
    if (r.statut === 'erreur') out.push({ titre: `Relancer la préparation : ${nom(r)}`, detail: r.preparation.erreur ?? 'La préparation n’a pas abouti', to: href({ page: 'rdv', id: r.id }), urgent: true })
    else if (!hasSite(r) && !r.scenarioId) out.push({ titre: `Compléter le RDV ${nom(r)}`, detail: 'Ajoutez le site web pour habiller la maquette', to: href({ page: 'rdv', id: r.id }), urgent: true })
  }
  const termines = rdvs.filter((x) => x.statut === 'termine').sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
  for (const r of termines.slice(0, 6)) {
    const suite = rdvs.some((x) => x.prospectId === r.prospectId && x.debut > r.debut)
    if (!suite && !r.scenarioId) out.push({ titre: `Planifier la suite avec ${nom(r)}`, detail: `Rendez-vous du ${dateCourte(r.debut)}, brief à ${progress(r.brief).pct} %`, to: href({ page: 'rdv', id: r.id }) })
    if (r.endedAt && now - r.endedAt < 2 * 86_400_000) out.push({ titre: `Envoyer le compte rendu à ${nom(r)}`, detail: `Rendez-vous ${jour(r.endedAt).toLowerCase()}`, to: href({ page: 'rdv', id: r.id }) })
  }
  return out.slice(0, 5)
}

function Bienvenue({ onNew, onDemo }: { onNew: () => void; onDemo: () => void }) {
  const { keys, settings } = useApp()
  const etapes = [
    { ok: !!settings.profil.nom, label: 'Votre profil', detail: 'Votre nom apparaît dans les comptes rendus.', to: href({ page: 'reglages', section: 'profil' }) },
    { ok: !!settings.agence.nom, label: 'Agence et signature', detail: 'Nom et logo de l’agence, mention dans les maquettes.', to: href({ page: 'reglages', section: 'agence' }) },
    { ok: !!keys?.claude, label: 'Claude', detail: 'Brief et maquette sur mesure (clé API ou Claude Code installé).', to: href({ page: 'reglages', section: 'ia' }) },
    { ok: !!keys?.gemini, label: 'Gemini', detail: 'Transcription de la visio (clé gratuite sur aistudio.google.com).', to: href({ page: 'reglages', section: 'ia' }) },
    { ok: false, label: 'Micro et son', detail: 'Vérifiez que votre micro et le son de la visio sont captés.', to: href({ page: 'reglages', section: 'son' }) }
  ]
  return (
    <Page>
      <div>
        <p className="small muted">{cap(dateLongue(Date.now()))}</p>
        <h1 className="h1" style={{ marginTop: 4 }}>
          Bienvenue dans AutoBuild
        </h1>
        <p className="muted" style={{ marginTop: 6, maxWidth: 680 }}>
          Pendant votre rendez-vous en visio, AutoBuild écoute, remplit le brief et construit une maquette aux couleurs du prospect, à lui montrer à la fin de l’appel.
        </p>
      </div>
      <div className="split">
        <div className="main">
          <section className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span className="kicker" style={{ color: 'var(--accent-ink)' }}>Essayer en 2 minutes</span>
            <h2 style={{ fontSize: 20, fontWeight: 700 }}>Un faux rendez-vous, rejoué en accéléré</h2>
            <p className="muted">Ternovia, entreprise de travaux publics fictive. Vous verrez la checklist se remplir, puis la maquette générée. Aucune clé ni micro nécessaires.</p>
            <div className="row">
              <button className="btn primary" onClick={onDemo}>
                <Icon name="play" size={16} /> Lancer la démonstration
              </button>
              <button className="btn" onClick={onNew}>
                Planifier un vrai rendez-vous
              </button>
            </div>
          </section>
          <Card title="Comment ça marche">
            <ol style={{ padding: '6px 0' }}>
              {[
                ['Avant', 'Créez le rendez-vous avec le site du prospect : identité visuelle, template et maquette de départ sont préparés à l’avance.'],
                ['Pendant', 'Démarrez : l’interface se retire, seule une petite checklist reste par-dessus votre visio, invisible en partage d’écran.'],
                ['Fin', 'Terminez : la maquette s’ouvre en plein écran, prête à être partagée.'],
                ['Après', 'Brief, transcription, maquette et compte rendu restent dans le rendez-vous.']
              ].map(([k, t]) => (
                <li key={k} className="rowlink" style={{ alignItems: 'flex-start' }}>
                  <span className="badge wip" style={{ width: 70, justifyContent: 'center' }}>
                    {k}
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <aside className="side">
          <Card title="Mise en route">
            {etapes.map((e) => (
              <a key={e.label} href={e.to} className="rowlink" style={{ alignItems: 'flex-start' }}>
                <StepIcon etat={e.ok ? 'fait' : 'a_venir'} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 600 }}>{e.label}</span>
                  <span className="small muted">{e.detail}</span>
                </span>
              </a>
            ))}
          </Card>
        </aside>
      </div>
    </Page>
  )
}
