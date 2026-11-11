// Données fictives réalistes (françaises), déterministes : la même graine donne
// toujours les mêmes données, pour que la maquette ne « saute » pas à chaque mise à jour du brief.

export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const PRENOMS = ['Camille', 'Julie', 'Thomas', 'Nicolas', 'Sophie', 'Antoine', 'Marie', 'Lucas', 'Émilie', 'Julien', 'Claire', 'Hugo', 'Laura', 'Mathieu', 'Sarah', 'Pierre', 'Manon', 'Alexandre', 'Léa', 'Romain', 'Chloé', 'Maxime', 'Pauline', 'Vincent']
export const NOMS = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefèvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'André', 'Mercier', 'Blanc', 'Guérin', 'Boyer', 'Garnier', 'Chevalier', 'Lambert']
export const VILLES = ['Rouen', 'Caen', 'Le Havre', 'Évreux', 'Paris', 'Lyon', 'Nantes', 'Rennes', 'Lille', 'Bordeaux', 'Toulouse', 'Amiens', 'Cherbourg', 'Dieppe', 'Alençon', 'Le Mans', 'Tours', 'Orléans', 'Angers', 'Reims']
export const RUES = ['rue de la République', 'avenue Jean Jaurès', 'rue Victor Hugo', 'boulevard Pasteur', 'rue des Écoles', 'route de Paris', 'rue du Général de Gaulle', 'allée des Tilleuls', 'rue de la Gare', 'quai de la Seine', 'zone d’activité des Portes', 'rue de l’Industrie']
const SOCIETES_A = ['Durand', 'Atelier', 'Groupe', 'Société', 'Établissements', 'Maison', 'Cabinet', 'Transports', 'Bâtiments', 'Industries', 'Laboratoires', 'Menuiserie']
const SOCIETES_B = ['Moreau', 'Lefèvre & Fils', 'Normandie', 'du Littoral', 'Garnier', 'Mercier', 'Vallée de Seine', 'Leroy', 'Atlantique', 'Bertrand', 'des Deux Rives', 'Chevalier']
const PRODUITS = ['Kit de fixation inox', 'Panneau isolant 100 mm', 'Câble armé 3G2,5', 'Joint EPDM', 'Vanne papillon DN80', 'Palette bois standard', 'Coffret électrique IP65', 'Tube acier galvanisé', 'Module capteur', 'Gaine technique', 'Plaque de plâtre BA13', 'Cartouche filtrante']
const SUJETS = ['Demande d’information', 'Problème de connexion', 'Retard de livraison', 'Mise à jour du dossier', 'Question sur la facture', 'Demande de rendez-vous', 'Réclamation qualité', 'Modification de commande']

export class Faker {
  private rnd: () => number
  constructor(seed: string) {
    this.rnd = seededRandom(seed)
  }
  float(): number {
    return this.rnd()
  }
  int(min: number, max: number): number {
    return Math.floor(this.rnd() * (max - min + 1)) + min
  }
  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.rnd() * list.length)]
  }
  personne(): string {
    return `${this.pick(PRENOMS)} ${this.pick(NOMS)}`
  }
  societe(): string {
    return `${this.pick(SOCIETES_A)} ${this.pick(SOCIETES_B)}`
  }
  /** Client plausible selon le secteur du prospect. */
  client(secteur?: string): string {
    const s = (secteur ?? '').toLowerCase()
    if (/(travaux|btp|bâtiment|batiment|voirie|construction|terrassement|réseaux|reseaux)/.test(s))
      return this.pick([`Commune de ${this.ville()}`, `Communauté de communes ${this.pick(['du Pays d’Auge', 'Cœur de Nacre', 'Seine-Eure', 'du Vexin', 'Terre d’Auge'])}`, `Département ${this.pick(['du Calvados', 'de l’Eure', 'de la Manche', 'de l’Orne'])}`, `SNC ${this.pick(['Les Jardins du Port', 'Résidence des Tilleuls', 'Parc d’activités Ouest'])}`, `${this.pick(['Bouygues', 'Eiffage', 'Vinci', 'NGE'])} ${this.pick(['Construction', 'Bâtiment', 'Immobilier'])} (sous-traitance)`, `Bailleur ${this.pick(['Habitat Normand', 'Logis de Seine', 'Cité Nouvelle'])}`])
    if (/(santé|sante|laboratoire|médical|medical|pharma|soin)/.test(s))
      return this.pick([`Centre hospitalier de ${this.ville()}`, `Clinique ${this.pick(['Saint-Martin', 'des Lilas', 'du Parc'])}`, `Pharmacie ${this.pick(NOMS)}`, `Cabinet médical ${this.pick(NOMS)}`, `EHPAD ${this.pick(['Les Glycines', 'Le Clos Fleuri', 'Les Charmilles'])}`])
    if (/(transport|logistique|portuaire)/.test(s))
      return this.pick([`${this.societe()} Logistique`, `Plateforme ${this.ville()}`, `Transports ${this.pick(NOMS)}`, `Négoce ${this.pick(NOMS)}`])
    return this.societe()
  }
  ville(): string {
    return this.pick(VILLES)
  }
  adresse(): string {
    return `${this.int(1, 140)} ${this.pick(RUES)}, ${this.ville()}`
  }
  email(name?: string): string {
    const n = (name ?? this.personne()).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '.')
    return `${n.replace(/^\.|\.$/g, '')}@${this.pick(['orange.fr', 'gmail.com', 'entreprise.fr', 'outlook.fr'])}`
  }
  telephone(): string {
    return `0${this.pick([1, 2, 6, 7])} ${Array.from({ length: 4 }, () => String(this.int(0, 99)).padStart(2, '0')).join(' ')}`
  }
  /** Date ISO autour d'aujourd'hui (jours relatifs). */
  date(fromDays = -60, toDays = 45, base = new Date()): string {
    const d = new Date(base.getTime() + this.int(fromDays, toDays) * 86_400_000)
    return d.toISOString().slice(0, 10)
  }
  produit(): string {
    return this.pick(PRODUITS)
  }
  sujet(): string {
    return this.pick(SUJETS)
  }
}
