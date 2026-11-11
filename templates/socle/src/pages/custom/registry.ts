// Pages personnalisées créées pour ce prospect (par l'IA ou à la main).
// Pour ajouter une page : créer src/pages/custom/MaPage.tsx (export function MaPage()),
// l'enregistrer ici, puis ajouter dans app.json une entrée de navigation
// { "id": "ma-page", "label": "…", "icone": "…", "type": "page", "cible": "ma-page" }.
import type { ComponentType } from 'react'

export const customPages: Record<string, ComponentType<{ itemId?: string }>> = {}
