// Contrat de données de la maquette (identique à src/shared/mockup.ts côté application AutoBuild).
// brand.json, agence.json et brief.json sont écrits par AutoBuild : ne pas les modifier à la main.
// app.json décrit l'application : navigation, entités, données fictives, tableau de bord.

export interface Brand {
  nomEntreprise: string
  url?: string
  /** Chemin public du logo, ex. "/brand/logo.svg" (vide si pas de logo). */
  logo?: string
  couleurs: { primaire: string; secondaire?: string; accent?: string }
  description?: string
  ton?: string
  slogan?: string
  police?: string
}

export interface Agence {
  nom: string
  mention: string
  logo?: string
}

export type FieldType =
  | 'texte'
  | 'texte-long'
  | 'nombre'
  | 'euro'
  | 'pourcent'
  | 'date'
  | 'statut'
  | 'choix'
  | 'email'
  | 'telephone'
  | 'personne'
  | 'reference'
  | 'booleen'

export interface Field {
  id: string
  label: string
  type: FieldType
  /** Valeurs possibles pour statut / choix. */
  options?: string[]
  /** Couleur par valeur de statut : "vert" | "orange" | "rouge" | "bleu" | "gris" | "violet". */
  couleurs?: Record<string, string>
  /** Pour type "reference" : id de l'entité liée (la valeur stockée est le titre de l'élément lié). */
  reference?: string
  /** Afficher la colonne dans la liste (par défaut : les 6 premiers champs). */
  dansListe?: boolean
}

export type Vue = 'liste' | 'kanban' | 'calendrier'

export interface Entity {
  id: string
  label: string
  labelPluriel: string
  icone: string
  /** Genre grammatical pour les libellés ("Nouveau chantier" / "Nouvelle facture"). */
  feminin?: boolean
  champs: Field[]
  /** Champ affiché comme titre de l'élément. */
  champTitre: string
  /** Champ de type statut utilisé par la vue kanban. */
  champStatut?: string
  /** Champ date utilisé par la vue calendrier. */
  champDate?: string
  vues: Vue[]
  donnees: Record<string, string | number | boolean | null>[]
}

export interface Kpi {
  label: string
  valeur: number
  format?: 'nombre' | 'euro' | 'pourcent'
  /** Évolution en % par rapport à la période précédente. */
  evolution?: number
}

export interface Graphique {
  titre: string
  type: 'barres' | 'courbe' | 'donut'
  donnees: { label: string; valeur: number }[]
  format?: 'nombre' | 'euro' | 'pourcent'
}

export interface NavItem {
  id: string
  label: string
  icone: string
  type: 'tableau-de-bord' | 'entite' | 'page'
  /** Id de l'entité (type "entite") ou de la page personnalisée (type "page", voir src/pages/custom/registry.ts). */
  cible?: string
  /** Rôles qui voient l'entrée (tous si absent). */
  roles?: string[]
  section?: string
  /** Pour une page de la bibliothèque : entité dont elle affiche les données (sinon la première adaptée). */
  source?: string
}

export interface Role {
  id: string
  label: string
  description?: string
}

export interface AppConfig {
  /** Mise en page : menu latéral (back-office) ou menu horizontal (portail, intranet, extranet). */
  layout?: 'sidebar' | 'topnav'
  titre: string
  sousTitre?: string
  typeProjet: string
  roles: Role[]
  roleParDefaut: string
  utilisateur: { nom: string; poste: string }
  navigation: NavItem[]
  tableauDeBord: {
    titre: string
    intro?: string
    kpis: Kpi[]
    graphiques: Graphique[]
    /** Listes « derniers éléments » d'une entité. */
    listes: { titre: string; entite: string; limite: number }[]
  }
  entites: Entity[]
}
