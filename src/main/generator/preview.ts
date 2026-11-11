// Serveur de preview local (Vite) de la maquette : rechargement à chaud à chaque modification.

import type { ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import { spawnNode } from './node-runner'
import type { Workspace } from './workspace'

export async function freePort(start = 5180): Promise<number> {
  for (let p = start; p < start + 100; p++) {
    const ok = await new Promise<boolean>((resolve) => {
      const srv = createServer()
      srv.once('error', () => resolve(false))
      srv.listen(p, '127.0.0.1', () => srv.close(() => resolve(true)))
    })
    if (ok) return p
  }
  throw new Error('Aucun port libre pour la preview')
}

export class PreviewServer {
  private child?: ChildProcess
  url?: string

  constructor(
    private ws: Workspace,
    private log: (msg: string, level?: 'info' | 'warn' | 'error') => void
  ) {}

  async start(): Promise<string> {
    const port = await freePort()
    const args = this.ws.template.dev.args.map((a) => a.replace('{port}', String(port)))
    this.child = spawnNode(this.ws.template.dev.script, args, this.ws.dir)
    let tail = ''
    const onData = (d: Buffer) => {
      const s = d.toString()
      tail = (tail + s).slice(-4000)
      for (const line of s.split('\n')) {
        if (/error|failed|erreur/i.test(line)) this.log(`Preview : ${line.trim().slice(0, 300)}`, 'warn')
      }
    }
    this.child.stdout?.on('data', onData)
    this.child.stderr?.on('data', onData)
    this.child.on('exit', (code) => {
      if (code && code !== 0) this.log(`Le serveur de preview s'est arrêté (code ${code}). ${tail.slice(-500)}`, 'error')
    })
    const url = `http://127.0.0.1:${port}/`
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
      try {
        const res = await fetch(url)
        if (res.ok) {
          this.url = url
          return url
        }
      } catch {
        /* pas encore prêt */
      }
      if (this.child.exitCode !== null) throw new Error(`Preview impossible : ${tail.slice(-800)}`)
      await new Promise((r) => setTimeout(r, 300))
    }
    throw new Error('La preview ne répond pas après 60 s')
  }

  stop(): void {
    this.child?.kill()
    this.child = undefined
    this.url = undefined
  }
}
