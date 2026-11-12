// Intégration « Claude Code installé » testée avec un faux exécutable `claude` (aucun appel réseau).
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { emptyBrief } from '@shared/brief/schema'
import { runAgent } from '../generator/agent'
import { ClaudeCodeBriefProvider } from '../brief/providers'
import { claudeStructured, findClaudeCli } from './cli'

const dir = mkdtempSync(join(tmpdir(), 'faux-claude-'))
const log = join(dir, 'appels.jsonl')

function fakeClaude(mode: 'ok' | 'non-connecte'): string {
  const p = join(dir, `claude-${mode}`)
  writeFileSync(
    p,
    `#!/usr/bin/env node
const fs = require('node:fs')
const args = process.argv.slice(2)
let input = ''
process.stdin.on('data', (d) => (input += d))
process.stdin.on('end', () => {
  fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify({ args, input: input.slice(0, 200), apiKey: process.env.ANTHROPIC_API_KEY || null }) + '\\n')
  if (${JSON.stringify(mode)} === 'non-connecte') {
    console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: true, result: 'Not logged in · Please run /login' }))
    return
  }
  if (args.includes('--json-schema')) {
    const schema = JSON.parse(args[args.indexOf('--json-schema') + 1])
    const out = schema.properties.updates
      ? { updates: [], typeProjet: 'erp', typeProjetPreuve: { segmentId: 'S1', citation: 'on veut un ERP pour nos stocks' }, resume: 'Un ERP', nouveauxChamps: [] }
      : { reponse: 'OK' }
    console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: '', structured_output: out, total_cost_usd: 0.01 }))
    return
  }
  // Agent (stream-json) : écrit un fichier comme le ferait l'outil Write.
  const file = process.cwd() + '/genere.txt'
  fs.writeFileSync(file, 'ok')
  console.log(JSON.stringify({ type: 'system', subtype: 'init' }))
  console.log(JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: file } }] } }))
  console.log(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'Page ajoutée', total_cost_usd: 0.2 }))
})
`
  )
  chmodSync(p, 0o755)
  return p
}

describe('Claude Code installé (faux exécutable)', () => {
  it('détecte un chemin personnalisé (script Node lancé sans shell)', async () => {
    const cli = await findClaudeCli(fakeClaude('ok'))
    expect(cli?.command).toBe(process.execPath)
    expect(cli?.prefixArgs[0]).toContain('claude-ok')
  })

  it('appel structuré : schéma JSON, prompt sur stdin, aucune clé API transmise', async () => {
    process.env.ANTHROPIC_API_KEY = 'ne-doit-pas-fuir'
    const cli = (await findClaudeCli(fakeClaude('ok')))!
    const { data } = await claudeStructured<{ reponse: string }>({ cli, model: 'claude-opus-5-5', system: 's', prompt: 'Réponds OK', schema: { type: 'object', properties: { reponse: { type: 'string' } } }, cwd: dir })
    expect(data.reponse).toBe('OK')
    const call = JSON.parse(readFileSync(log, 'utf8').trim().split('\n').pop()!)
    expect(call.input).toBe('Réponds OK')
    expect(call.apiKey).toBeNull()
    expect(call.args).toEqual(expect.arrayContaining(['-p', '--output-format', 'json', '--model', 'claude-opus-5-5', '--tools', '']))
    delete process.env.ANTHROPIC_API_KEY
  })

  it('brief par Claude Code : patch validé par le schéma', async () => {
    const cli = (await findClaudeCli(fakeClaude('ok')))!
    const p = new ClaudeCodeBriefProvider(cli, 'claude-opus-5-5', 'low', dir)
    const patch = await p.update({ brief: emptyBrief(), segments: [{ id: 'S1', speaker: 'prospect', startMs: 0, endMs: 1000, text: 'on veut un ERP pour nos stocks' }], newSegmentIds: ['S1'] })
    expect(patch.typeProjet).toBe('erp')
  })

  it('agent par Claude Code : suit les fichiers modifiés et le résultat', async () => {
    const cli = (await findClaudeCli(fakeClaude('ok')))!
    const ws = mkdtempSync(join(tmpdir(), 'ws-'))
    const activity: string[] = []
    const res = await runAgent({ backend: 'claude-code', cli, model: 'claude-opus-5-5', effort: 'low', cwd: ws, prompt: 'Fais la maquette', timeoutMs: 30_000, onActivity: (a) => activity.push(a) })
    expect(res.ok).toBe(true)
    expect(res.filesTouched).toEqual(['genere.txt'])
    expect(existsSync(join(ws, 'genere.txt'))).toBe(true)
    expect(activity[0]).toContain('genere.txt')
    const call = JSON.parse(readFileSync(log, 'utf8').trim().split('\n').pop()!)
    expect(call.args).toEqual(expect.arrayContaining(['--output-format', 'stream-json', '--permission-mode', 'dontAsk', '--tools', 'Read,Write,Edit,Glob,Grep']))
  })

  it('explique clairement quand Claude Code n’est pas connecté', async () => {
    const cli = (await findClaudeCli(fakeClaude('non-connecte')))!
    await expect(claudeStructured({ cli, model: 'm', system: 's', prompt: 'p', schema: {}, cwd: dir })).rejects.toThrow(/pas connecté/)
    const res = await runAgent({ backend: 'claude-code', cli, model: 'm', effort: 'low', cwd: dir, prompt: 'p', timeoutMs: 30_000, onActivity: () => {} })
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/pas connecté/)
  })
})
