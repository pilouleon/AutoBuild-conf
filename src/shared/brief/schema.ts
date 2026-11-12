// Schéma du brief et grille de qualification (le cœur du produit).
//
// Règle d'or : une information non dite reste « manquante ». Chaque info
// « obtenue » ou « partielle » doit porter au moins une preuve (citation exacte
// du transcript, ou extrait du site du prospect, ou saisie du commercial).
// Cette règle est vérifiée par le code (voir merge.ts), pas seulement par le prompt.

import { z } from 'zod'

export type FieldStatus = 'manquant' | 'partiel' | 'obtenu'

export interface BriefItem {
  nom: string
  details?: string
  /** Pour une entité : ses champs. Pour un rôle : ses actions. */
  attributs?: string[]
}

export type Evidence =
  | { source: 'transcript'; segmentId: string; citation: string }
  | { source: 'site'; url: string; citation: string }
  | { source: 'saisie'; citation: string }

export interface FieldState {
  status: FieldStatus
  /** Résumé lisible de l'info (une phrase). */
  valeur?: string
  /** Pour les champs de type liste. */
  items?: BriefItem[]
  preuves: Evidence[]
  majLe?: number
}

export type GroupId = 'entreprise' | 'projet' | 'utilisateurs' | 'fonctionnel' | 'technique' | 'commercial'

export interface FieldDef {
  id: string
  groupe: GroupId
  label: string
  /** Consigne pour le LLM : ce qu'on cherche exactement. */
  description: string
  type: 'texte' | 'liste'
  /** Question que le commercial peut poser si l'info manque. */
  question: string
  /** 1 = indispensable pour la maquette ou la qualification, 3 = bonus. */
  priorite: 1 | 2 | 3
  /** Utile pour construire la maquette (sinon : qualification commerciale). */
  maquette: boolean
}

export const GROUPS: { id: GroupId; label: string }[] = [
  { id: 'entreprise', label: 'Entreprise' },
  { id: 'projet', label: 'Projet' },
  { id: 'utilisateurs', label: 'Utilisateurs' },
  { id: 'fonctionnel', label: 'Fonctionnel' },
  { id: 'technique', label: 'Technique' },
  { id: 'commercial', label: 'Commercial' }
]

export const FIELDS: FieldDef[] = [
  // ── Entreprise ────────────────────────────────────────────────
  { id: 'entreprise_nom', groupe: 'entreprise', label: "Nom de l'entreprise", type: 'texte', priorite: 1, maquette: true,
    description: "Nom commercial de l'entreprise du prospect.", question: 'Pouvez-vous me rappeler le nom exact de votre structure ?' },
  { id: 'secteur', groupe: 'entreprise', label: "Secteur d'activité", type: 'texte', priorite: 1, maquette: true,
    description: "Métier et secteur de l'entreprise (ex. travaux publics, négoce de matériaux, laboratoire).", question: 'Pouvez-vous me décrire votre activité en quelques mots ?' },
  { id: 'taille', groupe: 'entreprise', label: 'Taille / organisation', type: 'texte', priorite: 2, maquette: false,
    description: "Effectif, nombre de sites, chiffre d'affaires, organisation (agences, filiales).", question: 'Combien êtes-vous, et sur combien de sites ?' },
  { id: 'interlocuteur', groupe: 'entreprise', label: 'Interlocuteur et rôle', type: 'texte', priorite: 2, maquette: false,
    description: "Nom et fonction de la personne qui parle côté prospect.", question: 'Quel est votre rôle dans le projet ?' },
  { id: 'identite', groupe: 'entreprise', label: 'Identité visuelle', type: 'texte', priorite: 2, maquette: true,
    description: "Couleurs, logo, charte, ton de communication (souvent issus du site web).", question: 'Avez-vous une charte graphique que l’outil devra respecter ?' },

  // ── Projet ────────────────────────────────────────────────────
  { id: 'type_projet', groupe: 'projet', label: 'Type de projet', type: 'texte', priorite: 1, maquette: true,
    description: "Nature de l'outil voulu (ERP, CRM, intranet, extranet, application métier, planning, mobile terrain...).", question: 'Si vous deviez résumer l’outil idéal en une phrase, ce serait quoi ?' },
  { id: 'contexte', groupe: 'projet', label: 'Contexte et déclencheur', type: 'texte', priorite: 1, maquette: false,
    description: 'Pourquoi maintenant : problème vécu, événement déclencheur, douleur actuelle.', question: 'Qu’est-ce qui vous pousse à lancer ce projet maintenant ?' },
  { id: 'objectifs', groupe: 'projet', label: 'Objectifs', type: 'liste', priorite: 1, maquette: true,
    description: 'Résultats attendus (gagner du temps, fiabiliser, suivre en temps réel...).', question: 'Comment saurez-vous dans un an que le projet est réussi ?' },
  { id: 'existant', groupe: 'projet', label: 'Outils existants', type: 'liste', priorite: 2, maquette: false,
    description: 'Outils utilisés aujourd’hui (Excel, logiciel du marché, papier...) et leurs limites.', question: 'Comment gérez-vous ça aujourd’hui, avec quels outils ?' },
  { id: 'modules', groupe: 'projet', label: 'Périmètre / modules', type: 'liste', priorite: 1, maquette: true,
    description: 'Grands blocs fonctionnels souhaités (ex. devis, planning, stocks, facturation, espace client).', question: 'Quels sont les grands blocs que l’outil doit couvrir ?' },

  // ── Utilisateurs ──────────────────────────────────────────────
  { id: 'roles', groupe: 'utilisateurs', label: 'Rôles utilisateurs', type: 'liste', priorite: 1, maquette: true,
    description: 'Profils qui utiliseront l’outil et ce qu’ils y font (attributs = actions principales).', question: 'Qui va utiliser l’outil au quotidien, et pour faire quoi ?' },
  { id: 'volume_utilisateurs', groupe: 'utilisateurs', label: "Nombre d'utilisateurs", type: 'texte', priorite: 2, maquette: false,
    description: 'Nombre d’utilisateurs par profil, internes et externes.', question: 'Combien de personnes l’utiliseront ?' },
  { id: 'acces', groupe: 'utilisateurs', label: 'Contexte d’utilisation', type: 'texte', priorite: 2, maquette: true,
    description: 'Bureau, terrain, mobile, tablette, accès externe (clients, partenaires).', question: 'L’outil sera utilisé au bureau, sur le terrain, sur mobile ?' },

  // ── Fonctionnel ───────────────────────────────────────────────
  { id: 'entites', groupe: 'fonctionnel', label: 'Objets métier', type: 'liste', priorite: 1, maquette: true,
    description: 'Objets manipulés (chantier, commande, dossier...) avec leurs informations clés (attributs = champs cités).', question: 'Quelles informations suivez-vous pour chaque dossier, chantier ou commande ?' },
  { id: 'processus', groupe: 'fonctionnel', label: 'Processus clés', type: 'liste', priorite: 1, maquette: true,
    description: 'Enchaînements et étapes de travail (du devis à la facture, validation en 3 étapes...).', question: 'Pouvez-vous me dérouler le parcours type, du début à la fin ?' },
  { id: 'ecrans_prioritaires', groupe: 'fonctionnel', label: 'Écrans prioritaires', type: 'liste', priorite: 2, maquette: true,
    description: 'Vues ou écrans explicitement demandés (planning, carte, tableau de bord, fiche client...).', question: 'S’il ne devait y avoir qu’un écran, lequel serait-ce ?' },
  { id: 'indicateurs', groupe: 'fonctionnel', label: 'Indicateurs / reporting', type: 'liste', priorite: 2, maquette: true,
    description: 'Indicateurs suivis, tableaux de bord, exports attendus.', question: 'Quels chiffres regardez-vous en premier chaque semaine ?' },

  // ── Technique ─────────────────────────────────────────────────
  { id: 'integrations', groupe: 'technique', label: 'Intégrations', type: 'liste', priorite: 2, maquette: false,
    description: 'Logiciels à connecter (comptabilité, ERP, paie, CRM, signature, API...).', question: 'Avec quels logiciels l’outil devra-t-il échanger des données ?' },
  { id: 'reprise_donnees', groupe: 'technique', label: 'Reprise de données', type: 'texte', priorite: 3, maquette: false,
    description: 'Données existantes à importer, volumes.', question: 'Faudra-t-il reprendre des données existantes ?' },
  { id: 'contraintes', groupe: 'technique', label: 'Contraintes', type: 'liste', priorite: 2, maquette: false,
    description: 'Hébergement, sécurité, RGPD, SSO, hors ligne, accessibilité, performance.', question: 'Avez-vous des contraintes d’hébergement, de sécurité ou de connexion ?' },

  // ── Commercial ────────────────────────────────────────────────
  { id: 'budget', groupe: 'commercial', label: 'Budget', type: 'texte', priorite: 1, maquette: false,
    description: 'Enveloppe budgétaire, fourchette, mode de financement.', question: 'Avez-vous une enveloppe budgétaire en tête pour ce projet ?' },
  { id: 'delai', groupe: 'commercial', label: 'Délai / échéances', type: 'texte', priorite: 1, maquette: false,
    description: 'Date de mise en service souhaitée, jalons, contraintes de calendrier.', question: 'Pour quand auriez-vous besoin d’une première version ?' },
  { id: 'decideurs', groupe: 'commercial', label: 'Décideurs et processus de décision', type: 'texte', priorite: 1, maquette: false,
    description: 'Qui décide, qui valide, comment se fait le choix (comité, appel d’offres).', question: 'Qui d’autre participera à la décision, et comment allez-vous choisir ?' },
  { id: 'concurrence', groupe: 'commercial', label: 'Autres prestataires consultés', type: 'texte', priorite: 2, maquette: false,
    description: 'Autres agences, éditeurs ou solutions étudiées.', question: 'Consultez-vous d’autres prestataires ou des logiciels du marché ?' },
  { id: 'criteres', groupe: 'commercial', label: 'Critères de choix', type: 'liste', priorite: 2, maquette: false,
    description: 'Ce qui fera choisir un prestataire (prix, proximité, références, méthode...).', question: 'Sur quels critères allez-vous choisir votre prestataire ?' },
  { id: 'prochaine_etape', groupe: 'commercial', label: 'Prochaine étape', type: 'texte', priorite: 2, maquette: false,
    description: 'Suite convenue (R2, envoi de proposition, démo, visite).', question: 'On cale ensemble la prochaine étape ?' }
]

export const FIELD_IDS = FIELDS.map((f) => f.id)

/** Champ ajouté au brief en cours de route : propre au type de projet, ou proposé par l'IA. */
export interface ExtraFieldDef extends FieldDef {
  origine: 'type' | 'ia'
  ajouteLe: number
}

export interface Brief {
  version: number
  majLe: number
  /** Id du catalogue (src/shared/catalog.ts) ou null si pas encore clair. */
  typeProjet: string | null
  resume: string
  champs: Record<string, FieldState>
  /** Infos ajoutées en cours de rendez-vous (par le type de projet ou par l'IA). */
  champsAjoutes: ExtraFieldDef[]
}

/** Toutes les infos du brief : la grille commune + celles ajoutées pour ce projet. */
export function allFields(brief?: Pick<Brief, 'champsAjoutes'>): FieldDef[] {
  return [...FIELDS, ...(brief?.champsAjoutes ?? [])]
}

export function getField(id: string, brief?: Pick<Brief, 'champsAjoutes'>): FieldDef | undefined {
  return FIELDS.find((f) => f.id === id) ?? brief?.champsAjoutes?.find((f) => f.id === id)
}

export function isExtra(id: string, brief: Pick<Brief, 'champsAjoutes'>): ExtraFieldDef | undefined {
  return brief.champsAjoutes?.find((f) => f.id === id)
}

export function emptyBrief(): Brief {
  const champs: Record<string, FieldState> = {}
  for (const f of FIELDS) champs[f.id] = { status: 'manquant', preuves: [] }
  return { version: 0, majLe: 0, typeProjet: null, resume: '', champs, champsAjoutes: [] }
}

/** Compatibilité avec les briefs enregistrés avant l'ajout des champs dynamiques. */
export function normalizeBrief(b: Brief): Brief {
  const champs = { ...b.champs }
  for (const f of FIELDS) if (!champs[f.id]) champs[f.id] = { status: 'manquant', preuves: [] }
  const extra = b.champsAjoutes ?? []
  for (const f of extra) if (!champs[f.id]) champs[f.id] = { status: 'manquant', preuves: [] }
  return { ...b, champs, champsAjoutes: extra }
}

// ── Format de sortie demandé au LLM (patch incrémental) ─────────
// Volontairement plat et sans union pour être accepté par les sorties
// structurées de Claude comme de Gemini.

export const PatchItemSchema = z.object({
  nom: z.string(),
  details: z.string().describe('Précision courte, chaîne vide si rien'),
  attributs: z.array(z.string()).describe('Champs d’une entité ou actions d’un rôle, tels que cités')
})

export const PatchEvidenceSchema = z.object({
  segmentId: z.string().describe('Identifiant du segment, ex. S12'),
  citation: z.string().describe('Extrait COPIÉ MOT POUR MOT du segment (5 à 25 mots)')
})

export const PatchUpdateSchema = z.object({
  fieldId: z.string().describe('Id d’une info de la grille, ou d’une info ajoutée (champsAjoutes ou nouveauxChamps)'),
  status: z.enum(['partiel', 'obtenu']),
  valeur: z.string().describe('Résumé fidèle en une phrase, sans extrapolation'),
  items: z.array(PatchItemSchema).describe('Pour les champs de type liste ; tableau vide sinon'),
  preuves: z.array(PatchEvidenceSchema)
})

export const NewFieldSchema = z.object({
  id: z.string().describe('Identifiant court en minuscules et tirets bas, ex. nb_chantiers_an'),
  label: z.string().describe('Libellé court affiché dans la checklist, ex. « Chantiers par an »'),
  description: z.string().describe('Ce qu’il faut obtenir exactement'),
  groupe: z.enum(['entreprise', 'projet', 'utilisateurs', 'fonctionnel', 'technique', 'commercial']),
  type: z.enum(['texte', 'liste'])
})

export const BriefPatchSchema = z.object({
  nouveauxChamps: z.array(NewFieldSchema).describe('0 à 2 infos à ajouter à la checklist car importantes pour CE projet et absentes de la grille'),
  updates: z.array(PatchUpdateSchema),
  typeProjet: z.string().describe('Id du catalogue, ou chaîne vide si pas encore clair'),
  typeProjetPreuve: PatchEvidenceSchema.nullable(),
  resume: z.string().describe('Le besoin en 1 à 2 phrases, uniquement à partir de ce qui a été dit')
})

export type BriefPatch = z.infer<typeof BriefPatchSchema>
export type PatchUpdate = z.infer<typeof PatchUpdateSchema>
export type NewField = z.infer<typeof NewFieldSchema>

export function emptyPatch(): BriefPatch {
  return { nouveauxChamps: [], updates: [], typeProjet: '', typeProjetPreuve: null, resume: '' }
}

/** Progression (toutes infos ou par groupe), champs ajoutés compris. */
export function progress(brief: Brief, groupe?: GroupId): { obtenu: number; partiel: number; total: number; pct: number } {
  const fields = allFields(brief).filter((f) => !groupe || f.groupe === groupe)
  let obtenu = 0
  let partiel = 0
  for (const f of fields) {
    const s = brief.champs[f.id]?.status
    if (s === 'obtenu') obtenu++
    else if (s === 'partiel') partiel++
  }
  const pct = fields.length ? Math.round(((obtenu + partiel * 0.5) / fields.length) * 100) : 0
  return { obtenu, partiel, total: fields.length, pct }
}

export interface ChecklistItem {
  id: string
  label: string
  status: FieldStatus
  valeur?: string
  cle: boolean
  origine: 'grille' | 'type' | 'ia'
  majLe: number
}

/**
 * Liste de la checklist du widget : les infos obtenues en haut (de la plus ancienne à la plus récente,
 * pour que les nouvelles arrivent juste au-dessus des manques), puis les infos à obtenir en bas
 * (les clés en dernier, au plus près du bas de l'écran).
 */
export function checklist(brief: Brief): { obtenus: ChecklistItem[]; manquants: ChecklistItem[] } {
  const items: ChecklistItem[] = allFields(brief).map((f) => {
    const c = brief.champs[f.id]
    const extra = isExtra(f.id, brief)
    return {
      id: f.id,
      label: f.label,
      status: c?.status ?? 'manquant',
      valeur: c?.items?.length ? c.items.map((i) => i.nom).join(', ') : c?.valeur,
      cle: f.priorite === 1,
      origine: extra ? extra.origine : 'grille',
      majLe: c?.majLe ?? extra?.ajouteLe ?? 0
    }
  })
  const obtenus = items.filter((i) => i.status !== 'manquant').sort((a, b) => a.majLe - b.majLe)
  const manquants = items.filter((i) => i.status === 'manquant').sort((a, b) => Number(a.cle) - Number(b.cle))
  return { obtenus, manquants }
}
