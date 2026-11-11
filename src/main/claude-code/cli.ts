// Mode « abonnement Claude Code » : AutoBuild appelle le Claude Code INSTALLÉ sur le poste (binaire officiel,
// non modifié), en mode headless (`claude -p`). Claude Code utilise sa propre connexion (celle faite avec
// `claude` puis /login) : AutoBuild ne lit, ne copie ni ne stocke aucun identifiant.
//
// Usage prévu : tester AutoBuild sur son propre poste avec son propre abonnement.
// Pour un produit distribué à des clients, Anthropic demande l'authentification par clé API (voir docs/claude-code.md).

import { type ChildProcess, execFile, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

export interface ClaudeCli {
  /** Exécutable à lancer. */
  command: string
  /** Arguments à placer avant les nôtres (ex. script cli.js quand Claude Code est installé via npm). */
  prefixArgs: string[]
  /** Variables d'environnement à ajouter (ex. ELECTRON_RUN_AS_NODE). */
  env: Record<string, string>
  path: string
}

function candidates(): string[] {
  const h = homedir()
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? join(h, 'AppData', 'Roaming')
    const local = process.env.LOCALAPPDATA ?? join(h, 'AppData', 'Local')
    return [
      join(h, '.local', 'bin', 'claude.exe'),
      join(h, '.claude', 'local', 'claude.exe'),
      join(local, 'Programs', 'claude', 'claude.exe'),
      join(local, 'Microsoft', 'WinGet', 'Links', 'claude.exe'),
      join(appData, 'npm', 'claude.cmd')
    ]
  }
  return [
    join(h, '.local', 'bin', 'claude'),
    join(h, '.claude', 'local', 'claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
    join(h, '.npm-global', 'bin', 'claude'),
    join(h, '.bun', 'bin', 'claude'),
    '/usr/bin/claude'
  ]
}

/** Cherche `claude` dans le PATH de l'utilisateur (les apps lancées depuis le Finder n'ont pas le PATH du terminal). */
function whichClaude(): Promise<string | undefined> {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      execFile('where.exe', ['claude'], { windowsHide: true, timeout: 5000 }, (err, out) => {
        const lines = err ? [] : out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
        resolve(lines.find((l) => l.toLowerCase().endsWith('.exe')) ?? lines[0])
      })
    } else {
      const shell = process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash')
      execFile(shell, ['-lc', 'command -v claude'], { timeout: 5000 }, (err, out) => resolve(err ? undefined : out.trim().split('\n').pop() || undefined))
    }
  })
}

/** Résout un chemin vers une commande lançable sans shell (gère l'installation npm « claude.cmd » sous Windows). */
function toCli(path: string): ClaudeCli | undefined {
  if (!existsSync(path)) return undefined
  if (/\.(cmd|ps1|bat)$/i.test(path)) {
    const pkg = join(dirname(path), 'node_modules', '@anthropic-ai', 'claude-code')
    const exe = join(pkg, 'bin', 'claude.exe')
    if (existsSync(exe)) return { command: exe, prefixArgs: [], env: {}, path }
    const js = ['cli.js', 'cli.mjs'].map((f) => join(pkg, f)).find(existsSync)
    if (!js) return undefined
    // Script Node : lancé avec le Node embarqué d'Electron (pas besoin de shell).
    return { command: process.execPath, prefixArgs: [js], env: process.versions.electron ? { ELECTRON_RUN_AS_NODE: '1' } : {}, path }
  }
  // Script Node « #!/usr/bin/env node » (installation npm sous macOS / Linux).
  try {
    const head = readFileSync(path, { encoding: 'utf8', flag: 'r' }).slice(0, 64)
    if (head.startsWith('#!') && head.includes('node')) return { command: process.execPath, prefixArgs: [path], env: process.versions.electron ? { ELECTRON_RUN_AS_NODE: '1' } : {}, path }
  } catch {
    /* binaire natif : lecture texte sans importance */
  }
  return { command: path, prefixArgs: [], env: {}, path }
}

export async function findClaudeCli(customPath?: string): Promise<ClaudeCli | undefined> {
  if (customPath?.trim()) return toCli(customPath.trim())
  for (const c of candidates()) {
    const cli = toCli(c)
    if (cli) return cli
  }
  const found = await whichClaude()
  return found ? toCli(found) : undefined
}

/** Environnement de Claude Code : sans clé API, pour qu'il utilise sa propre connexion (abonnement). */
function cliEnv(cli: ClaudeCli): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...cli.env }
  delete env.ANTHROPIC_API_KEY
  delete env.ANTHROPIC_AUTH_TOKEN
  delete env.CLAUDECODE
  if (!cli.env.ELECTRON_RUN_AS_NODE) delete env.ELECTRON_RUN_AS_NODE
  return env
}

export interface RunOptions {
  cli: ClaudeCli
  args: string[]
  /** Envoyé sur l'entrée standard (évite les limites de longueur de ligne de commande). */
  input: string
  cwd: string
  timeoutMs: number
  signal?: AbortSignal
  /** Une ligne de sortie (mode stream-json). */
  onLine?: (line: string) => void
}

export interface RunResult {
  code: number
  stdout: string
  stderr: string
  timedOut: boolean
}

export function runClaude(o: RunOptions): Promise<RunResult> {
  return new Promise((resolve) => {
    let child: ChildProcess
    try {
      child = spawn(o.cli.command, [...o.cli.prefixArgs, ...o.args], { cwd: o.cwd, env: cliEnv(o.cli), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
    } catch (err) {
      resolve({ code: 1, stdout: '', stderr: String(err), timedOut: false })
      return
    }
    let stdout = ''
    let stderr = ''
    let buffer = ''
    let timedOut = false
    child.stdout?.on('data', (d: Buffer) => {
      const s = d.toString()
      stdout += s
      if (o.onLine) {
        buffer += s
        let i: number
        while ((i = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, i).trim()
          buffer = buffer.slice(i + 1)
          if (line) o.onLine(line)
        }
      }
    })
    child.stderr?.on('data', (d: Buffer) => (stderr = (stderr + d.toString()).slice(-20_000)))
    const kill = () => child.kill()
    const timer = setTimeout(() => {
      timedOut = true
      kill()
    }, o.timeoutMs)
    o.signal?.addEventListener('abort', kill)
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ code: 1, stdout, stderr: stderr + String(err), timedOut })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (buffer.trim() && o.onLine) o.onLine(buffer.trim())
      resolve({ code: code ?? 1, stdout, stderr, timedOut })
    })
    child.stdin?.end(o.input)
  })
}

interface ResultJson {
  type?: string
  subtype?: string
  is_error?: boolean
  result?: string
  structured_output?: unknown
  total_cost_usd?: number
}

/** Dernier objet JSON « result » de la sortie. */
export function parseResult(stdout: string): ResultJson | undefined {
  const lines = stdout.trim().split('\n').reverse()
  for (const l of lines) {
    try {
      const j = JSON.parse(l) as ResultJson
      if (j.type === 'result') return j
    } catch {
      /* ligne non JSON */
    }
  }
  try {
    const j = JSON.parse(stdout) as ResultJson
    return j.type === 'result' ? j : undefined
  } catch {
    return undefined
  }
}

/** Message d'erreur lisible (non connecté, option inconnue d'une ancienne version…). */
export function explainFailure(r: RunResult, res?: ResultJson): string {
  const text = `${res?.result ?? ''}\n${r.stderr}\n${r.stdout.slice(-2000)}`
  if (r.timedOut) return 'délai dépassé'
  if (/not logged in|please run \/login|invalid api key|authentication|oauth|401/i.test(text))
    return "Claude Code n'est pas connecté : ouvrez un terminal, lancez « claude », puis /login avec votre compte Claude."
  if (/unknown option|unrecognized|error: option/i.test(text)) return 'Version de Claude Code trop ancienne : mettez-la à jour (« claude update »).'
  if (/usage limit|rate limit|limit reached/i.test(text)) return "Limite d'usage de votre abonnement Claude atteinte."
  return (res?.result || r.stderr || r.stdout).trim().slice(-400) || `code ${r.code}`
}

/** Appel simple avec sortie structurée (JSON Schema) : brief, analyse du site, test de connexion. */
export async function claudeStructured<T>(o: {
  cli: ClaudeCli
  model: string
  system: string
  prompt: string
  schema: Record<string, unknown>
  cwd: string
  timeoutMs?: number
  signal?: AbortSignal
  effort?: string
}): Promise<{ data: T; costUsd?: number }> {
  const args = [
    '-p',
    '--output-format',
    'json',
    '--json-schema',
    JSON.stringify(o.schema),
    '--model',
    o.model,
    '--system-prompt',
    o.system,
    '--tools',
    '',
    '--no-session-persistence',
    '--setting-sources',
    '',
    '--strict-mcp-config'
  ]
  if (o.effort) args.push('--effort', o.effort)
  const r = await runClaude({ cli: o.cli, args, input: o.prompt, cwd: o.cwd, timeoutMs: o.timeoutMs ?? 120_000, signal: o.signal })
  const res = parseResult(r.stdout)
  if (!res || res.is_error || res.subtype !== 'success') throw new Error(explainFailure(r, res))
  let data = res.structured_output
  if (data === undefined && res.result) {
    const m = res.result.match(/\{[\s\S]*\}/)
    if (m) data = JSON.parse(m[0])
  }
  if (data === undefined) throw new Error('Réponse de Claude Code sans données structurées.')
  return { data: data as T, costUsd: res.total_cost_usd }
}

export async function claudeVersion(cli: ClaudeCli): Promise<string | undefined> {
  const r = await runClaude({ cli, args: ['--version'], input: '', cwd: homedir(), timeoutMs: 15_000 })
  return r.code === 0 ? r.stdout.match(/\d+\.\d+\.\d+[^\n]*/)?.[0]?.trim() : undefined
}
