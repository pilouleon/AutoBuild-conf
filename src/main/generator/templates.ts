// Registre des templates : templates intégrés + templates fournis par l'agence.
// Un template est un dossier contenant template.json (voir docs/templates.md).
//
// Deux formes :
//  - un projet complet (dev, check, mockupDir…) ;
//  - un manifeste qui « étend » un projet de base (`extends`) : il ne décrit que sa mise en page et sa
//    bibliothèque de pages. Les templates intégrés (ERP, application métier, extranet, intranet) étendent
//    le « socle », qui contient le kit d'interface et les pages sur mesure communes.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { TemplateInfo, TemplatePage } from '@shared/types'

export interface TemplateManifest {
  id: string
  name: string
  version?: string
  description: string
  /** Ids du catalogue couverts ; "*" = tous (template de repli). */
  projectTypes: string[]
  fallback?: boolean
  /** Id du template de base dont on reprend le projet. */
  extends?: string
  layout?: 'sidebar' | 'topnav'
  couleur?: string
  pages?: TemplatePage[]
  dev: { script: string; args: string[] }
  check: { script: string; args: string[] }
  mockupDir: string
  brandAssetsDir: string
}

export interface LoadedTemplate extends TemplateManifest {
  /** Dossier du projet (celui du template de base pour un manifeste). */
  dir: string
  /** Dossier du manifeste lui-même (fichiers à superposer au projet de base). */
  ownDir: string
  source: 'integre' | 'agence'
  ready: boolean
  problem?: string
  pages: TemplatePage[]
}

function readManifest(dir: string): Partial<TemplateManifest> | undefined {
  const file = join(dir, 'template.json')
  if (!existsSync(file)) return undefined
  return JSON.parse(readFileSync(file, 'utf8')) as Partial<TemplateManifest>
}

function check(t: LoadedTemplate): LoadedTemplate {
  let problem: string | undefined
  if (!t.dev?.script) problem = 'template.json incomplet (dev)'
  else if (!existsSync(join(t.dir, t.dev.script))) problem = `dépendances non installées (lancer « npm install » dans ${t.dir})`
  else if (!existsSync(join(t.dir, t.mockupDir))) problem = `dossier ${t.mockupDir} introuvable`
  return { ...t, ready: !problem, problem }
}

export function listTemplates(builtinRoot: string, agencyRoot?: string): LoadedTemplate[] {
  const raw: { dir: string; source: LoadedTemplate['source']; m?: Partial<TemplateManifest>; err?: string }[] = []
  for (const [root, source] of [
    [agencyRoot, 'agence'],
    [builtinRoot, 'integre']
  ] as const) {
    if (!root || !existsSync(root)) continue
    for (const d of readdirSync(root, { withFileTypes: true })) {
      if (!d.isDirectory()) continue
      const dir = join(root, d.name)
      try {
        const m = readManifest(dir)
        if (m) raw.push({ dir, source, m })
      } catch (err) {
        raw.push({ dir, source, err: (err as Error).message })
      }
    }
  }
  const out: LoadedTemplate[] = []
  for (const r of raw) {
    if (r.err || !r.m?.id) {
      out.push({ id: r.dir, name: r.dir, description: '', projectTypes: [], dev: { script: '', args: [] }, check: { script: '', args: [] }, mockupDir: '', brandAssetsDir: '', dir: r.dir, ownDir: r.dir, source: r.source, ready: false, problem: `template.json invalide : ${r.err ?? 'id manquant'}`, pages: [] })
      continue
    }
    // Un template d'agence remplace un template intégré de même id.
    if (out.some((o) => o.id === r.m!.id)) continue
    let base: Partial<TemplateManifest> & { dir?: string } = {}
    if (r.m.extends) {
      const b = raw.find((x) => x.m?.id === r.m!.extends && !x.m?.extends)
      if (!b?.m) {
        out.push({ ...(r.m as TemplateManifest), dir: r.dir, ownDir: r.dir, source: r.source, ready: false, problem: `template de base « ${r.m.extends} » introuvable`, pages: r.m.pages ?? [] })
        continue
      }
      base = { ...b.m, dir: b.dir }
    }
    const t: LoadedTemplate = {
      ...(base as TemplateManifest),
      ...(r.m as TemplateManifest),
      // Le repli et la mise en page ne s'héritent pas du projet de base.
      fallback: r.m.fallback,
      dev: r.m.dev ?? (base.dev as TemplateManifest['dev']),
      check: r.m.check ?? (base.check as TemplateManifest['check']),
      mockupDir: r.m.mockupDir ?? (base.mockupDir as string),
      brandAssetsDir: r.m.brandAssetsDir ?? (base.brandAssetsDir as string),
      dir: base.dir ?? r.dir,
      ownDir: r.dir,
      source: r.source,
      ready: false,
      pages: r.m.pages ?? []
    }
    out.push(check(t))
  }
  return out
}

/** Template le plus adapté au type de projet : celui de l'agence d'abord, puis l'intégré, puis le repli. */
export function selectTemplate(templates: LoadedTemplate[], projectType: string | null, choisi?: string): LoadedTemplate | undefined {
  const ready = templates.filter((t) => t.ready)
  if (choisi && choisi !== 'auto') {
    const t = ready.find((x) => x.id === choisi)
    if (t) return t
  }
  if (projectType) {
    const exact = ready.filter((t) => t.projectTypes.includes(projectType))
    if (exact.length) return exact.find((t) => t.source === 'agence') ?? exact[0]
  }
  return ready.find((t) => t.fallback && t.source === 'agence') ?? ready.find((t) => t.fallback) ?? ready[0]
}

/** Deux templates partagent-ils le même projet (on peut alors passer de l'un à l'autre en cours d'appel) ? */
export function sameProject(a: LoadedTemplate, b: LoadedTemplate): boolean {
  return a.dir === b.dir
}

export function toInfo(t: LoadedTemplate): TemplateInfo {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    projectTypes: t.projectTypes,
    source: t.source,
    ready: t.ready,
    problem: t.problem,
    layout: t.layout,
    couleur: t.couleur,
    pages: t.pages
  }
}
