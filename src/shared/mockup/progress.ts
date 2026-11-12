// Avancement de la maquette pendant le rendez-vous, affiché dans le widget et l'interface.

import type { Brief } from '../brief/schema'
import type { GenerationState, SessionPhase } from '../types'

export interface MaquetteEtape {
  id: 'depart' | 'structure' | 'sur-mesure' | 'donnees' | 'finition'
  label: string
  detail: string
  etat: 'fait' | 'en_cours' | 'a_venir' | 'sans_objet'
}

export function maquetteProgress(g: GenerationState, brief: Brief, phase: SessionPhase): { pct: number; etapes: MaquetteEtape[]; courante?: MaquetteEtape } {
  const ok = (kind: string) => g.steps.some((s) => s.kind === kind && s.status === 'ok')
  const running = (kind: string) => g.steps.some((s) => s.kind === kind && s.status === 'en_cours')
  const ia = g.agentDisponible !== false
  const objets = brief.champs.entites?.items?.length ?? 0
  const structure = g.agentOwnsApp || objets > 0 || !!brief.typeProjet
  const fin = phase === 'termine' && g.steps.some((s) => s.kind === 'verification' && s.label.startsWith('Vérification finale') && s.status === 'ok')
  const etapes: MaquetteEtape[] = [
    { id: 'depart', label: 'Maquette de départ', detail: 'Connexion et tableau de bord aux couleurs du prospect', etat: g.planBCommit ? 'fait' : 'en_cours' },
    { id: 'structure', label: 'Structure', detail: objets ? `${objets} objet${objets > 1 ? 's' : ''} métier du prospect` : 'Dès que le prospect décrit ce qu’il suit', etat: structure ? 'fait' : 'a_venir' },
    {
      id: 'sur-mesure',
      label: 'Sur mesure par l’IA',
      detail: !ia ? 'IA de génération non disponible' : g.activity ?? (ok('structure') ? 'Pages adaptées au prospect' : 'Quand le besoin est assez clair'),
      etat: !ia && !ok('structure') ? 'sans_objet' : ok('structure') ? 'fait' : running('structure') ? 'en_cours' : 'a_venir'
    },
    {
      id: 'donnees',
      label: 'Données réalistes',
      detail: ia ? 'Après la structure' : 'Données d’exemple du secteur',
      etat: ok('donnees') || (!ia && structure) ? 'fait' : running('donnees') ? 'en_cours' : 'a_venir'
    },
    { id: 'finition', label: 'Finition', detail: 'À la fin du rendez-vous', etat: fin ? 'fait' : running('finition') || phase === 'finalisation' ? 'en_cours' : 'a_venir' }
  ]
  const comptees = etapes.filter((e) => e.etat !== 'sans_objet')
  const faites = comptees.filter((e) => e.etat === 'fait').length + comptees.filter((e) => e.etat === 'en_cours').length * 0.5
  const courante = etapes.find((e) => e.etat === 'en_cours') ?? etapes.find((e) => e.etat === 'a_venir')
  // La première « à venir » après une étape faite devient l'étape courante affichée.
  return { pct: Math.round((faites / comptees.length) * 100), etapes, courante }
}
