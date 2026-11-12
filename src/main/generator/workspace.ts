// Espace de travail d'une maquette : copie du template + instantanés (sans git,
// qui n'est pas forcément installé chez le commercial).
// Les instantanés ne concernent que les dossiers modifiables (src, public) : c'est rapide.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, relative, sep } from 'node:path'
import type { LoadedTemplate } from './templates'

const SNAP_DIRS = ['src', 'public']
const SKIP = new Set(['.vite-cache', 'dist', '.autobuild', '.git'])

export class Workspace {
  readonly snapDir: string
  private counter = 0

  constructor(
    readonly dir: string,
    /** Modifiable : on peut changer de template en cours d'appel s'il partage le même projet. */
    public template: LoadedTemplate
  ) {
    this.snapDir = join(dir, '.autobuild', 'instantanes')
  }

  static create(root: string, name: string, template: LoadedTemplate): Workspace {
    const dir = uniqueDir(root, name)
    mkdirSync(dir, { recursive: true })
    // Copie complète, node_modules compris (la maquette doit tourner sans réseau ni npm).
    cpSync(template.dir, dir, {
      recursive: true,
      filter: (src) => {
        const rel = relative(template.dir, src)
        const first = rel.split(sep)[0]
        return !SKIP.has(first)
      }
    })
    // Template « manifeste » : ses fichiers propres sont superposés au projet de base.
    if (template.ownDir !== template.dir) {
      cpSync(template.ownDir, dir, { recursive: true, filter: (src) => !SKIP.has(relative(template.ownDir, src).split(sep)[0]) })
    }
    const ws = new Workspace(dir, template)
    mkdirSync(ws.snapDir, { recursive: true })
    unquarantine(dir)
    return ws
  }

  /** Rouvre une maquette existante (rendez-vous préparé à l'avance, ou RDV passé). */
  static open(dir: string, template: LoadedTemplate): Workspace {
    const ws = new Workspace(dir, template)
    mkdirSync(ws.snapDir, { recursive: true })
    ws.counter = ws.listSnapshots().length
    return ws
  }

  /** Copie une maquette existante (reprise pour un R2). */
  static duplicate(root: string, name: string, fromDir: string, template: LoadedTemplate): Workspace {
    const dir = uniqueDir(root, name)
    cpSync(fromDir, dir, { recursive: true, filter: (src) => relative(fromDir, src).split(sep)[0] !== '.autobuild' && !relative(fromDir, src).startsWith('.vite-cache') })
    const ws = new Workspace(dir, template)
    mkdirSync(ws.snapDir, { recursive: true })
    unquarantine(dir)
    return ws
  }

  path(...p: string[]): string {
    return join(this.dir, ...p)
  }

  mockupPath(file: string): string {
    return join(this.dir, this.template.mockupDir, file)
  }

  writeJson(file: string, data: unknown): void {
    writeFileSync(this.mockupPath(file), JSON.stringify(data, null, 2) + '\n', 'utf8')
  }

  readJson<T>(file: string): T | undefined {
    try {
      return JSON.parse(readFileSync(this.mockupPath(file), 'utf8')) as T
    } catch {
      return undefined
    }
  }

  /** Enregistre l'état actuel ; renvoie l'id de l'instantané. */
  snapshot(label: string): string {
    const id = `${String(++this.counter).padStart(3, '0')}-${label.replace(/[^a-z0-9-]+/gi, '-').slice(0, 30)}`
    const dest = join(this.snapDir, id)
    for (const d of SNAP_DIRS) if (existsSync(this.path(d))) cpSync(this.path(d), join(dest, d), { recursive: true })
    return id
  }

  /** Restaure un instantané (retour arrière). */
  restore(id: string): void {
    const src = join(this.snapDir, id)
    if (!existsSync(src)) throw new Error(`Instantané ${id} introuvable`)
    for (const d of SNAP_DIRS) {
      if (!existsSync(join(src, d))) continue
      // On remplace fichier par fichier pour ne pas casser le serveur de preview (pas de dossier supprimé).
      syncDir(join(src, d), this.path(d))
    }
  }

  listSnapshots(): string[] {
    return existsSync(this.snapDir) ? readdirSync(this.snapDir).sort() : []
  }
}

/**
 * macOS : les fichiers copiés depuis une application téléchargée gardent l'attribut de quarantaine,
 * qui peut bloquer les binaires natifs (Vite, Tailwind, TypeScript). On le retire de la maquette.
 */
function unquarantine(dir: string): void {
  if (process.platform !== 'darwin') return
  try {
    execFileSync('xattr', ['-dr', 'com.apple.quarantine', dir], { stdio: 'ignore' })
  } catch {
    /* attribut absent */
  }
}

function uniqueDir(root: string, name: string): string {
  const date = new Date().toISOString().slice(0, 10)
  let dir = join(root, `${date}-${name}`)
  let i = 2
  while (existsSync(dir)) dir = join(root, `${date}-${name}-${i++}`)
  return dir
}

/** Rend dest identique à src (ajouts, modifications, suppressions). */
function syncDir(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true })
  const srcEntries = new Set(readdirSync(src))
  for (const name of readdirSync(dest)) {
    if (!srcEntries.has(name)) rmSync(join(dest, name), { recursive: true, force: true })
  }
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name)
    const d = join(dest, entry.name)
    if (entry.isDirectory()) syncDir(s, d)
    else {
      const content = readFileSync(s)
      if (!existsSync(d) || !content.equals(readFileSync(d))) writeFileSync(d, content)
    }
  }
}
