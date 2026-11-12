// Bibliothèque de pages prêtes à l'emploi, activées depuis app.json par une entrée de navigation
// { "type": "page", "cible": "<id>", "source": "<id d'entité, facultatif>" }.
// Elles s'adaptent aux entités de la maquette ; pour un écran vraiment spécifique, créer plutôt une page dans src/pages/custom/.
import type { ComponentType } from 'react'
import { AccueilPortail } from './AccueilPortail'
import { Actualites } from './Actualites'
import { Annuaire } from './Annuaire'
import type { LibraryPageProps } from './data'
import { Devis } from './Devis'
import { Documents } from './Documents'
import { Droits } from './Droits'
import { Parametres } from './Parametres'
import { Planning } from './Planning'
import { Reporting } from './Reporting'
import { Stocks } from './Stocks'
import { Suivi } from './Suivi'
import { Tickets } from './Tickets'

export const libraryPages: Record<string, ComponentType<LibraryPageProps>> = {
  planning: Planning,
  devis: Devis,
  stocks: Stocks,
  reporting: Reporting,
  droits: Droits,
  parametres: Parametres,
  documents: Documents,
  actualites: Actualites,
  annuaire: Annuaire,
  'accueil-portail': AccueilPortail,
  tickets: Tickets,
  suivi: Suivi
}
