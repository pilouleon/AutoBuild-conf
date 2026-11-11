// Consignes envoyées à l'agent de génération, étape par étape.

import { briefStateForPrompt } from '@shared/brief/prompt'
import type { Brief } from '@shared/brief/schema'
import { getProjectType } from '@shared/catalog'
import type { Brand } from '@shared/types'

export type AgentStepKind = 'structure' | 'donnees' | 'finition' | 'correction'

export interface PromptContext {
  brief: Brief
  brand: Brand
  previousBriefState?: string
  stepNumber: number
  minutesLeft?: number
  checkErrors?: string
}

function header(c: PromptContext): string {
  const pt = getProjectType(c.brief.typeProjet)
  return `ENTREPRISE DU PROSPECT : ${c.brand.nomEntreprise}${c.brand.url ? ` (${c.brand.url})` : ''}
${c.brand.description ? `Activité (site web) : ${c.brand.description}\n` : ''}${c.brand.ton ? `Ton de communication : ${c.brand.ton}\n` : ''}TYPE DE PROJET : ${pt ? `${pt.label} — ${pt.description}` : 'pas encore clair'}
${pt ? `Pages typiques pour ce type de projet (hypothèses, à adapter) : ${pt.pagesTypiques.join(', ')}\n` : ''}
BRIEF ACTUEL (issu de la conversation, « manquant » = pas encore dit) :
${briefStateForPrompt(c.brief)}`
}

export function agentPrompt(kind: AgentStepKind, c: PromptContext): string {
  const ctx = header(c)
  switch (kind) {
    case 'structure':
      return `${ctx}

${c.previousBriefState ? `BRIEF LORS DE TA DERNIÈRE ÉTAPE (pour repérer ce qui a changé) :\n${c.previousBriefState}\n\n` : ''}ÉTAPE ${c.stepNumber} — STRUCTURE DE LA MAQUETTE
L'appel est en cours. Une version de base a été générée automatiquement dans src/mockup/app.json à partir du brief (entités, champs, navigation, données génériques).
${c.stepNumber > 1 ? 'Tu as déjà fait des étapes précédentes : garde ce qui est bien, intègre uniquement ce qui a changé dans le brief.\n' : ''}
Fais maintenant du sur-mesure :
1. Lis CLAUDE.md puis src/mockup/app.json et src/mockup/types.ts.
2. Ajuste app.json : titre de l'application parlant pour le prospect, navigation dans l'ordre logique de son métier, entités et champs avec SES mots, statuts qui correspondent à son processus, rôles.
3. Si le prospect a décrit un écran ou un processus clé (voir processus, ecrans_prioritaires, objectifs), crée UNE page sur mesure soignée dans src/pages/custom/ qui le met en scène (ex. planning, suivi d'étapes, carte, vue synthèse), enregistre-la et ajoute-la à la navigation.
4. Ne touche pas aux fichiers interdits par CLAUDE.md.
Va vite : environ ${c.minutesLeft ?? 4} minutes.`

    case 'donnees':
      return `${ctx}

ÉTAPE ${c.stepNumber} — DONNÉES RÉALISTES
La structure est en place. Rends les données de src/mockup/app.json crédibles pour ce prospect :
- noms de clients, produits, chantiers, dossiers… typiques de son secteur et de sa région ; réutilise les noms et services présents dans src/mockup/site.txt s'il existe ;
- montants, dates, quantités et statuts cohérents entre eux (une facture payée a une date passée, un chantier terminé est à 100 %…) ;
- 10 à 18 éléments par entité, et des indicateurs du tableau de bord cohérents avec ces données.
Ne change pas la structure (champs, navigation) sauf erreur manifeste. Environ ${c.minutesLeft ?? 3} minutes.`

    case 'finition':
      return `${ctx}

ÉTAPE FINALE — FINITION AVANT LA DÉMO
Le rendez-vous se termine, le commercial va partager son écran dans quelques instants.
1. Vérifie que chaque entrée de la navigation mène à une page remplie et cohérente (pas de page vide, pas de libellé anglais ou générique du type « Élément 1 »).
2. Vérifie que ce que le prospect a dit (brief) se retrouve dans la maquette avec ses mots ; ajoute ce qui manque si c'est rapide.
3. Tableau de bord : indicateurs cités par le prospect en premier, titres clairs.
4. Corrige les incohérences visibles. Pas de nouvelle grosse fonctionnalité.
Environ ${c.minutesLeft ?? 3} minutes.`

    case 'correction':
      return `La compilation TypeScript de la maquette échoue après ta dernière modification. Corrige UNIQUEMENT ces erreurs, au plus simple (supprimer ou simplifier le code fautif est acceptable) :

${(c.checkErrors ?? '').slice(0, 6000)}`
  }
}
