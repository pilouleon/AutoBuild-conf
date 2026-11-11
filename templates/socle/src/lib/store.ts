// Données en mémoire de la maquette (modifiables pendant la démo, remises à zéro au rechargement).
import { useSyncExternalStore } from 'react'
import { app } from '../mockup'

type Row = Record<string, string | number | boolean | null>
const data: Record<string, Row[]> = Object.fromEntries(app.entites.map((e) => [e.id, e.donnees.map((d, i) => ({ id: String(d.id ?? i + 1), ...d }))]))
const listeners = new Set<() => void>()

export function useRows(entityId: string): Row[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => data[entityId] ?? EMPTY
  )
}
const EMPTY: Row[] = []

export function addRow(entityId: string, row: Row): void {
  data[entityId] = [{ id: String(Date.now()), ...row }, ...(data[entityId] ?? [])]
  listeners.forEach((l) => l())
}

export function updateRow(entityId: string, id: string, patch: Row): void {
  data[entityId] = (data[entityId] ?? []).map((r) => (String(r.id) === id ? { ...r, ...patch } : r))
  listeners.forEach((l) => l())
}
