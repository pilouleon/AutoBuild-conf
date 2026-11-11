// Agent de génération : Claude modifie le code de la maquette dans l'espace de travail,
// en suivant le CLAUDE.md du template. Outils limités aux fichiers (lecture / écriture / recherche) :
// pas de shell, pas de réseau.
//
// Deux moteurs :
//  - « api »         : Claude Agent SDK + clé API Anthropic (mode prévu pour le produit) ;
//  - « claude-code » : le Claude Code installé sur le poste, avec l'abonnement de l'utilisateur (`claude -p`).

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { type ClaudeCli, explainFailure, parseResult, runClaude } from '../claude-code/cli'

export interface AgentRunOptions {
  backend: 'api' | 'claude-code'
  apiKey?: string
  cli?: ClaudeCli
  model: string
  effort: 'low' | 'medium' | 'high'
  cwd: string
  prompt: string
  timeoutMs: number
  onActivity: (text: string) => void
  signal?: AbortSignal
}

export interface AgentRunResult {
  ok: boolean
  message: string
  costUsd?: number
  filesTouched: string[]
}

const TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep']
const APPEND =
  'Tu travailles en temps réel pendant un rendez-vous commercial : sois rapide et va droit au but. Suis strictement le CLAUDE.md du projet. Termine par une phrase qui résume ce que tu as changé.'

/** Dans l'app packagée, le binaire de l'agent est hors de l'archive asar. */
function executablePath(): string | undefined {
  const resources = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  if (!process.versions.electron || !resources) return undefined
  const pkg = `claude-agent-sdk-${process.platform}-${process.arch}`
  const bin = process.platform === 'win32' ? 'claude.exe' : 'claude'
  const p = join(resources, 'app.asar.unpacked', 'node_modules', '@anthropic-ai', pkg, bin)
  return existsSync(p) ? p : undefined
}

/** Message de l'agent (même format pour le SDK et pour `claude -p --output-format stream-json`). */
interface AgentMessage {
  type: string
  subtype?: string
  is_error?: boolean
  result?: string
  total_cost_usd?: number
  api_error_status?: number | null
  message?: { content?: { type: string; name?: string; input?: unknown; text?: string }[] }
}

class Tracker {
  files = new Set<string>()
  summary = ''
  constructor(
    private cwd: string,
    private onActivity: (t: string) => void
  ) {}

  rel(p: string): string {
    return p.replace(this.cwd, '').replace(/^[\\/]/, '')
  }

  /** Renvoie un résultat quand le message est le résultat final. */
  handle(msg: AgentMessage): AgentRunResult | undefined {
    if (msg.type === 'assistant') {
      for (const block of msg.message?.content ?? []) {
        if (block.type === 'tool_use') {
          const input = (block.input ?? {}) as { file_path?: string }
          if ((block.name === 'Edit' || block.name === 'Write') && input.file_path) {
            this.files.add(this.rel(input.file_path))
            this.onActivity(`${block.name === 'Write' ? 'Écrit' : 'Modifie'} ${this.rel(input.file_path)}`)
          } else if (block.name === 'Read' && input.file_path) {
            this.onActivity(`Lit ${this.rel(input.file_path)}`)
          }
        } else if (block.type === 'text' && block.text?.trim()) {
          this.summary = block.text.trim()
        }
      }
    } else if (msg.type === 'result') {
      const files = [...this.files]
      const cost = msg.total_cost_usd
      if (msg.subtype === 'success' && !msg.is_error) return { ok: true, message: msg.result?.trim() || this.summary || 'Étape terminée', costUsd: cost, filesTouched: files }
      if (msg.subtype === 'success')
        return { ok: false, message: `Erreur de l'IA : ${msg.result?.trim() || 'erreur inconnue'}${msg.api_error_status ? ` (HTTP ${msg.api_error_status})` : ''}`, costUsd: cost, filesTouched: files }
      return { ok: false, message: `Agent arrêté : ${msg.subtype}`, costUsd: cost, filesTouched: files }
    }
    return undefined
  }
}

export function runAgent(o: AgentRunOptions): Promise<AgentRunResult> {
  return o.backend === 'claude-code' ? runWithClaudeCode(o) : runWithSdk(o)
}

async function runWithSdk(o: AgentRunOptions): Promise<AgentRunResult> {
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), o.timeoutMs)
  o.signal?.addEventListener('abort', () => abort.abort())
  const tracker = new Tracker(o.cwd, o.onActivity)
  try {
    const env: Record<string, string | undefined> = { ...process.env, ANTHROPIC_API_KEY: o.apiKey }
    // Ne pas hériter d'une éventuelle session Claude Code parente.
    delete env.CLAUDECODE
    delete env.ELECTRON_RUN_AS_NODE
    const q = query({
      prompt: o.prompt,
      options: {
        cwd: o.cwd,
        model: o.model,
        effort: o.effort,
        tools: TOOLS,
        allowedTools: TOOLS,
        permissionMode: 'dontAsk',
        settingSources: ['project'],
        persistSession: false,
        maxTurns: 80,
        abortController: abort,
        env,
        pathToClaudeCodeExecutable: executablePath(),
        systemPrompt: { type: 'preset', preset: 'claude_code', append: APPEND }
      }
    })
    for await (const msg of q) {
      const res = tracker.handle(msg as unknown as AgentMessage)
      if (res) return res
    }
    return { ok: false, message: 'Agent terminé sans résultat', filesTouched: [...tracker.files] }
  } catch (err) {
    return { ok: false, message: abort.signal.aborted ? 'Délai dépassé ou étape annulée' : `Erreur de l'agent : ${(err as Error).message}`, filesTouched: [...tracker.files] }
  } finally {
    clearTimeout(timer)
  }
}

async function runWithClaudeCode(o: AgentRunOptions): Promise<AgentRunResult> {
  if (!o.cli) return { ok: false, message: 'Claude Code introuvable sur ce poste.', filesTouched: [] }
  const tracker = new Tracker(o.cwd, o.onActivity)
  let final: AgentRunResult | undefined
  const args = [
    '-p',
    '--output-format',
    'stream-json',
    '--verbose',
    '--model',
    o.model,
    '--effort',
    o.effort,
    '--tools',
    TOOLS.join(','),
    '--allowedTools',
    TOOLS.join(','),
    '--permission-mode',
    'dontAsk',
    '--setting-sources',
    'project',
    '--strict-mcp-config',
    '--no-session-persistence',
    '--append-system-prompt',
    APPEND
  ]
  const r = await runClaude({
    cli: o.cli,
    args,
    input: o.prompt,
    cwd: o.cwd,
    timeoutMs: o.timeoutMs,
    signal: o.signal,
    onLine: (line) => {
      try {
        final = tracker.handle(JSON.parse(line) as AgentMessage) ?? final
      } catch {
        /* ligne non JSON */
      }
    }
  })
  if (final && final.ok) return final
  if (final && !final.ok && /not logged|login|401|authentication/i.test(final.message)) return { ...final, message: explainFailure(r, parseResult(r.stdout)) }
  if (final) return final
  if (o.signal?.aborted) return { ok: false, message: 'Étape annulée', filesTouched: [...tracker.files] }
  return { ok: false, message: `Claude Code : ${explainFailure(r, parseResult(r.stdout))}`, filesTouched: [...tracker.files] }
}
