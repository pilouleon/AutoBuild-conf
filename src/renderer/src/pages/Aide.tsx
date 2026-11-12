// Aide : le parcours d'un rendez-vous, le plan de l'application, les raccourcis.
import { type Route, href } from '../lib/router'
import { Page } from '../shell/Shell'
import { Icon } from '../ui/icons'
import { Card } from '../ui/kit'

const PARCOURS: { etape: string; label: string; detail: string; to?: Route; live?: boolean }[] = [
  { etape: 'Avant', label: 'Nouveau rendez-vous', detail: 'Prospect, site web, créneau, interlocuteurs.', to: { page: 'rdvs' } },
  { etape: 'Avant', label: 'Préparation', detail: 'Identité visuelle, template, maquette de départ et plan B, automatiquement.' },
  { etape: 'Lancer', label: 'Vérification du son', detail: 'Micro et son de la visio testés, accord du prospect.' },
  { etape: 'Pendant', label: 'Widget sur la visio', detail: 'Infos obtenues en vert en haut, infos à obtenir en bas.', live: true },
  { etape: 'Pendant', label: 'Retour à l’interface', detail: 'Bandeau rouge : brief, maquette et transcription en direct.', live: true },
  { etape: 'Fin', label: 'Présentation', detail: 'La maquette s’ouvre en plein écran, prête à être partagée.' },
  { etape: 'Après', label: 'Synthèse', detail: 'Brief, transcription, maquette, compte rendu, rendez-vous suivant.' }
]

export function Aide() {
  const mac = window.autobuild.platform === 'darwin'
  const cols: { titre: string; to: Route; items: [string, Route, number][] }[] = [
    { titre: 'Accueil', to: { page: 'accueil' }, items: [['Prochain rendez-vous', { page: 'accueil' }, 2], ['Cette semaine', { page: 'accueil' }, 2], ['À faire', { page: 'accueil' }, 2], ['Derniers rendez-vous', { page: 'accueil' }, 2]] },
    {
      titre: 'Rendez-vous',
      to: { page: 'rdvs' },
      items: [
        ['À venir et passés, calendrier', { page: 'rdvs' }, 2],
        ['Rendez-vous à venir', { page: 'rdvs', filtre: 'avenir' }, 2],
        ['Préparation, brief de départ, maquette de départ', { page: 'rdvs', filtre: 'avenir' }, 3],
        ['Rendez-vous passé', { page: 'rdvs', filtre: 'passes' }, 2],
        ['Synthèse et compte rendu', { page: 'rdvs', filtre: 'passes' }, 3],
        ['Brief › détail d’une info', { page: 'rdvs', filtre: 'passes' }, 3],
        ['Transcription › moments clés', { page: 'rdvs', filtre: 'passes' }, 3],
        ['Maquette › pages et versions', { page: 'rdvs', filtre: 'passes' }, 3]
      ]
    },
    { titre: 'Prospects', to: { page: 'prospects' }, items: [['Liste des entreprises', { page: 'prospects' }, 2], ['Fiche : rendez-vous, interlocuteurs, identité, maquettes', { page: 'prospects' }, 3]] },
    { titre: 'Templates', to: { page: 'templates' }, items: [['Bibliothèque', { page: 'templates' }, 2], ['Template › pages, infos à obtenir', { page: 'templates' }, 3]] },
    {
      titre: 'Réglages',
      to: { page: 'reglages' },
      items: [
        ['Mon compte : profil, micro et son, widget', { page: 'reglages', section: 'profil' }, 2],
        ['Agence : signature, templates, grille', { page: 'reglages', section: 'agence' }, 2],
        ['Connexions : accès IA, agenda', { page: 'reglages', section: 'ia' }, 2]
      ]
    }
  ]
  return (
    <Page>
      <div>
        <h1 className="h1">Aide et guide</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Le parcours d’un rendez-vous et le plan de l’application.
        </p>
      </div>
      <Card title="Le parcours d’un rendez-vous">
        <ol className="row wrap" style={{ padding: 20, gap: 10, alignItems: 'stretch' }}>
          {PARCOURS.map((p, i) => (
            <li key={p.label} className="row" style={{ gap: 10, alignItems: 'center' }}>
              <div style={{ width: 150, padding: '12px 14px', borderRadius: 12, border: `1px solid ${p.live ? '#fecaca' : 'var(--line)'}`, background: p.live ? 'var(--err-soft)' : 'var(--soft)', height: '100%' }}>
                <p className="kicker" style={{ fontSize: 10, color: p.live ? 'var(--rec)' : 'var(--accent-ink)' }}>
                  {p.etape}
                </p>
                <p className="strong" style={{ marginTop: 2 }}>
                  {p.label}
                </p>
                <p className="xs muted" style={{ marginTop: 4 }}>
                  {p.detail}
                </p>
              </div>
              {i < PARCOURS.length - 1 && <Icon name="arrow" size={16} style={{ color: 'var(--ink-4)' }} />}
            </li>
          ))}
        </ol>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {cols.map((c) => (
          <section key={c.titre} className="card" style={{ padding: 18 }}>
            <a href={href(c.to)} className="strong" style={{ display: 'block', marginBottom: 10 }}>
              {c.titre}
            </a>
            {c.items.map(([l, to, n]) => (
              <a key={l} href={href(to)} className="row small" style={{ padding: '4px 0', paddingLeft: n === 3 ? 16 : 0, color: n === 3 ? 'var(--ink-3)' : 'var(--ink-2)' }}>
                <span className="dot" style={{ width: 6, height: 6, background: n === 2 ? 'var(--ink-4)' : '#d1d5db' }} />
                {l}
              </a>
            ))}
          </section>
        ))}
      </div>
      <Card title="Accès rapides, partout dans l’application">
        <ul className="stack small" style={{ padding: 20, gap: 10, color: 'var(--ink-2)' }}>
          <li>
            <b>Carte « Prochain RDV »</b> en bas de la navigation : démarrer en un clic depuis n’importe quel écran.
          </li>
          <li>
            <b>Recherche {mac ? '⌘ K' : 'Ctrl K'}</b> : prospects, rendez-vous, templates, réglages.
          </li>
          <li>
            <b>Nouveau rendez-vous</b> toujours en haut à droite.
          </li>
          <li>
            <b>Pendant un rendez-vous</b> : le widget renvoie à l’interface, le bandeau rouge de l’interface renvoie au widget ; raccourci {mac ? '⌥ ⌘ C' : 'Ctrl Alt C'}.
          </li>
          <li>
            <b>Liens croisés</b> : une info du brief ouvre le passage de la transcription ; une version de maquette se restaure depuis l’onglet Maquette.
          </li>
        </ul>
      </Card>
      <Card title="Confidentialité">
        <p className="small" style={{ padding: 20, color: 'var(--ink-2)' }}>
          Rendez-vous, transcriptions et maquettes restent sur ce poste. Le son est envoyé à Gemini pour la transcription, le texte à Claude (ou Gemini) pour le brief et la maquette. Prévenez toujours le prospect que
          l’échange est transcrit.
        </p>
      </Card>
    </Page>
  )
}
