// Agent de génération : Claude (via le Claude Agent SDK, le moteur de Claude Code)
// modifie le code de la maquette dans l'espace de travail, en suivant le CLAUDE.md du template.
// Outils limités aux fichiers (lecture / écriture / recherche) : pas de shell, pas de réseau.

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { query } from '@anthropic-ai/claude-agent-sdk'

export interface AgentRunOptions {
  apiKey: string
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

/** Dans l'app packagée, le binaire de l'agent est hors de l'archive asar. */
function executablePath(): string | undefined {
  const resources = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath
  if (!process.versions.electron || !resources) return undefined
  const pkg = `claude-agent-sdk-${process.platform}-${process.arch}`
  const bin = process.platform === 'win32' ? 'claude.exe' : 'claude'
  const p = join(resources, 'app.asar.unpacked', 'node_modules', '@anthropic-ai', pkg, bin)
  return existsSync(p) ? p : undefined
}

export async function runAgent(o: AgentRunOptions): Promise<AgentRunResult> {
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), o.timeoutMs)
  o.signal?.addEventListener('abort', () => abort.abort())
  const filesTouched = new Set<string>()
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
        systemPrompt: {
          type: 'preset',
          preset: 'claude_code',
          append:
            'Tu travailles en temps réel pendant un rendez-vous commercial : sois rapide et va droit au but. Suis strictement le CLAUDE.md du projet. Termine par une phrase qui résume ce que tu as changé.'
        }
      }
    })
    let summary = ''
    for await (const msg of q) {
      if (msg.type === 'assistant') {
        for (const block of msg.message.content) {
          if (block.type === 'tool_use') {
            const input = block.input as { file_path?: string; pattern?: string }
            if ((block.name === 'Edit' || block.name === 'Write') && input.file_path) {
              const rel = input.file_path.replace(o.cwd, '').replace(/^[\\/]/, '')
              filesTouched.add(rel)
              o.onActivity(`${block.name === 'Write' ? 'Écrit' : 'Modifie'} ${rel}`)
            } else if (block.name === 'Read' && input.file_path) {
              o.onActivity(`Lit ${input.file_path.replace(o.cwd, '').replace(/^[\\/]/, '')}`)
            }
          } else if (block.type === 'text' && block.text.trim()) {
            summary = block.text.trim()
          }
        }
      } else if (msg.type === 'result') {
        const cost = msg.total_cost_usd
        if (msg.subtype === 'success' && !msg.is_error) return { ok: true, message: msg.result?.trim() || summary || 'Étape terminée', costUsd: cost, filesTouched: [...filesTouched] }
        if (msg.subtype === 'success') return { ok: false, message: `Erreur de l'IA : ${msg.result?.trim() || 'erreur inconnue'}${msg.api_error_status ? ` (HTTP ${msg.api_error_status})` : ''}`, costUsd: cost, filesTouched: [...filesTouched] }
        return { ok: false, message: `Agent arrêté : ${msg.subtype}`, costUsd: cost, filesTouched: [...filesTouched] }
      }
    }
    return { ok: false, message: 'Agent terminé sans résultat', filesTouched: [...filesTouched] }
  } catch (err) {
    const aborted = abort.signal.aborted
    return { ok: false, message: aborted ? 'Délai dépassé ou étape annulée' : `Erreur de l'agent : ${(err as Error).message}`, filesTouched: [...filesTouched] }
  } finally {
    clearTimeout(timer)
  }
}
