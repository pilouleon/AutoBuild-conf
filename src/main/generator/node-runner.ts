// Lance un script Node (vite, tsc) avec le Node embarqué d'Electron :
// le commercial n'a pas besoin d'installer Node.js sur sa machine.

import { type ChildProcess, spawn } from 'node:child_process'
import { join } from 'node:path'

export function nodeCommand(): { command: string; env: NodeJS.ProcessEnv } {
  const env: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' }
  if (process.versions.electron) env.ELECTRON_RUN_AS_NODE = '1'
  return { command: process.execPath, env }
}

export function spawnNode(script: string, args: string[], cwd: string, extraEnv: Record<string, string> = {}): ChildProcess {
  const { command, env } = nodeCommand()
  return spawn(command, [join(cwd, script), ...args], { cwd, env: { ...env, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
}

export function runNode(script: string, args: string[], cwd: string, timeoutMs = 120_000): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawnNode(script, args, cwd)
    let output = ''
    const onData = (d: Buffer) => {
      output += d.toString()
      if (output.length > 200_000) output = output.slice(-100_000)
    }
    child.stdout?.on('data', onData)
    child.stderr?.on('data', onData)
    const timer = setTimeout(() => {
      output += '\n[délai dépassé]'
      child.kill()
    }, timeoutMs)
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, output })
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({ code: 1, output: output + String(err) })
    })
  })
}
