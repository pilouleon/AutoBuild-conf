// Prompts du moteur de brief, communs à Claude et Gemini.

import { PROJECT_TYPES } from '../catalog'
import type { TranscriptSegment } from '../types'
import { type Brief, FIELDS, GROUPS } from './schema'

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function formatSegments(segments: TranscriptSegment[]): string {
  return segments
    .map((s) => `[${s.id} ${formatTime(s.startMs)} ${s.speaker === 'commercial' ? 'COMMERCIAL' : 'PROSPECT'}] ${s.text}`)
    .join('\n')
}

/** Partie stable du prompt (mise en cache côté Claude). */
export function briefSystemPrompt(): string {
  const grille = GROUPS.map((g) => {
    const lignes = FIELDS.filter((f) => f.groupe === g.id)
      .map((f) => `  - ${f.id} (${f.type}) : ${f.label}. ${f.description}`)
      .join('\n')
    return `${g.label}\n${lignes}`
  }).join('\n')
  const catalogue = PROJECT_TYPES.map((t) => `  - ${t.id} : ${t.label}. Signaux : ${t.signaux.join(', ')}`).join('\n')

  return `Tu assistes un commercial d'une agence de développement sur mesure pendant un premier rendez-vous (visio) avec un prospect. Tu reçois la transcription en direct, découpée en segments identifiés (S1, S2...). COMMERCIAL = le commercial de l'agence, PROSPECT = le ou les interlocuteurs côté client (plusieurs personnes peuvent être mélangées sous PROSPECT).

Ta mission : tenir à jour un brief structuré du projet du prospect, selon la grille ci-dessous, pour (1) qualifier le prospect et (2) construire en parallèle une maquette de son futur outil.

RÈGLES ABSOLUES
1. Tu n'inventes rien. Une information n'entre dans le brief que si elle a été DITE dans la transcription. Pas de déduction, pas de valeur « probable », pas de complément avec des connaissances générales sur le secteur.
2. Chaque mise à jour porte au moins une preuve : l'identifiant du segment et une citation copiée MOT POUR MOT depuis ce segment (5 à 25 mots). Une mise à jour sans citation exacte sera rejetée automatiquement.
3. status = "obtenu" si l'info est claire et suffisante ; "partiel" si elle est évoquée mais incomplète ou floue. Une info non évoquée n'apparaît pas dans updates (elle reste manquante).
4. Les propos du COMMERCIAL ne comptent comme preuve que si le PROSPECT les confirme (ex. le commercial reformule et le prospect dit « oui, c'est ça ») : dans ce cas cite le segment du PROSPECT si possible.
5. Ne renvoie dans updates que les champs nouveaux ou qui changent par rapport au brief actuel. Si le prospect se corrige, la dernière version l'emporte.
6. Pour les champs de type liste, renvoie la liste COMPLÈTE à jour dans items (pas seulement les ajouts). Pour "entites", mets dans attributs les informations suivies citées (ex. "date de début", "chef de chantier", "statut"). Pour "roles", mets dans attributs ce que fait ce profil.
7. Le micro du commercial peut capter en écho la voix du prospect : ignore les doublons évidents.
8. La transcription automatique contient des erreurs : corrige l'orthographe évidente des noms dans valeur, mais la citation doit rester celle du segment.

GRILLE DE QUALIFICATION (id, type, description)
${grille}

CATALOGUE DES TYPES DE PROJET (typeProjet = un de ces id, ou chaîne vide si ce n'est pas encore clair)
${catalogue}

QUESTIONS SUGGÉRÉES
Propose 2 ou 3 questions naturelles, en français, que le commercial peut poser MAINTENANT pour obtenir les infos manquantes les plus utiles (priorité : type de projet, modules, objets métier, rôles, puis budget, délai, décideurs). Formule-les en lien avec ce qui vient d'être dit.

Réponds uniquement avec l'objet JSON demandé.`
}

/** Résumé compact de l'état actuel du brief pour le LLM. */
export function briefStateForPrompt(brief: Brief): string {
  const lignes: string[] = []
  for (const f of FIELDS) {
    const c = brief.champs[f.id]
    if (!c || c.status === 'manquant') {
      lignes.push(`${f.id}: manquant`)
      continue
    }
    const items = c.items?.length
      ? ` | items: ${c.items.map((i) => i.nom + (i.attributs?.length ? ` (${i.attributs.join(', ')})` : '')).join(' ; ')}`
      : ''
    lignes.push(`${f.id}: ${c.status} | ${c.valeur ?? ''}${items}`)
  }
  return `typeProjet: ${brief.typeProjet ?? '(pas encore clair)'}\nresume: ${brief.resume || '(vide)'}\n${lignes.join('\n')}`
}

export function briefUserInstruction(brief: Brief, newSegmentIds: string[]): string {
  return `BRIEF ACTUEL
${briefStateForPrompt(brief)}

NOUVEAUX SEGMENTS DEPUIS LA DERNIÈRE MISE À JOUR : ${newSegmentIds.length ? newSegmentIds.join(', ') : '(aucun)'}

Mets à jour le brief à partir de la transcription complète ci-dessus, en te concentrant sur les nouveaux segments. Respecte strictement les règles.`
}
