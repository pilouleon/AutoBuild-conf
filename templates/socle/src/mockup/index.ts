// Point d'entrée des données de la maquette.
import appJson from './app.json'
import agenceJson from './agence.json'
import brandJson from './brand.json'
import type { Agence, AppConfig, Brand, Entity } from './types'

export const app = appJson as unknown as AppConfig
export const brand = brandJson as Brand
export const agence = agenceJson as Agence

export function getEntity(id: string | undefined): Entity | undefined {
  return app.entites.find((e) => e.id === id)
}

export type { AppConfig, Brand, Agence, Entity } from './types'
