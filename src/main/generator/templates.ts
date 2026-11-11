// Registre des templates : templates intégrés + templates fournis par l'agence.
// Un template est un dossier contenant template.json (voir docs/templates.md).

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { TemplateInfo } from '@shared/types'

export interface TemplateManifest {
  id: string
  name: string
  version?: string
  description: string
  /** Ids du catalogue couverts ; "*" = tous (template de repli). */
  projectTypes: string[]
  fallback?: boolean
  dev: { script: string; args: string[] }
  check: { script: string; args: string[] }
  mockupDir: string
  brandAssetsDir: string
}

export interface LoadedTemplate extends TemplateManifest {
  dir: string
  source: 'integre' | 'agence'
  ready: boolean
  problem?: string
}

function load(dir: string, source: LoadedTemplate['source']): LoadedTemplate | undefined {
  const file = join(dir, 'template.json')
  if (!existsSync(file)) return undefined
  try {
    const m = JSON.parse(readFileSync(file, 'utf8')) as TemplateManifest
    let problem: string | undefined
    if (!existsSync(join(dir, m.dev.script))) problem = `dépendances non installées (lancer « npm install » dans ${dir})`
    else if (!existsSync(join(dir, m.mockupDir))) problem = `dossier ${m.mockupDir} introuvable`
    return { ...m, dir, source, ready: !problem, problem }
  } catch (err) {
    return { id: dir, name: dir, description: '', projectTypes: [], dev: { script: '', args: [] }, check: { script: '', args: [] }, mockupDir: '', brandAssetsDir: '', dir, source, ready: false, problem: `template.json invalide : ${(err as Error).message}` }
  }
}

export function listTemplates(builtinRoot: string, agencyRoot?: string): LoadedTemplate[] {
  const out: LoadedTemplate[] = []
  for (const [root, source] of [
    [agencyRoot, 'agence'],
    [builtinRoot, 'integre']
  ] as const) {
    if (!root || !existsSync(root)) continue
    for (const d of readdirSync(root, { withFileTypes: true })) {
      if (!d.isDirectory()) continue
      const t = load(join(root, d.name), source)
      // Un template d'agence remplace un template intégré de même id.
      if (t && !out.some((o) => o.id === t.id)) out.push(t)
    }
  }
  return out
}

/** Template le plus adapté au type de projet : celui de l'agence d'abord, puis l'intégré, puis le repli. */
export function selectTemplate(templates: LoadedTemplate[], projectType: string | null): LoadedTemplate | undefined {
  const ready = templates.filter((t) => t.ready)
  if (projectType) {
    const exact = ready.filter((t) => t.projectTypes.includes(projectType))
    if (exact.length) return exact.find((t) => t.source === 'agence') ?? exact[0]
  }
  return ready.find((t) => t.fallback && t.source === 'agence') ?? ready.find((t) => t.fallback) ?? ready[0]
}

export function toInfo(t: LoadedTemplate): TemplateInfo {
  return { id: t.id, name: t.name, description: t.description, projectTypes: t.projectTypes, source: t.source, ready: t.ready, problem: t.problem }
}
