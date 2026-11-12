// Scénarios de démonstration : un faux rendez-vous rejoué (transcript horodaté)
// et, pour le mode sans clé API, les patchs de brief tels qu'un LLM les produirait.
// Les patchs passent par la même validation des preuves que les vrais.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { BriefPatch } from '@shared/brief/schema'
import type { Contact, ScenarioInfo, Speaker } from '@shared/types'
import type { RawSegment } from './types'

export interface Scenario {
  id: string
  titre: string
  description: string
  prospect: { nom: string; url: string; notes?: string }
  /** Personnes côté prospect (fictives). */
  interlocuteurs?: Contact[]
  /** t = secondes depuis le début ; d = durée de parole en secondes. */
  segments: { t: number; d: number; speaker: Speaker; text: string }[]
  /** Patchs rejoués quand le transcript atteint le segment indiqué (index 1-based, = id S<n>). */
  briefPatches: { apresSegment: number; patch: BriefPatch }[]
}

export function loadScenario(dir: string): Scenario {
  const s = JSON.parse(readFileSync(join(dir, 'scenario.json'), 'utf8')) as Scenario
  // URL relative "site/index.html" → fichier local du scénario.
  if (s.prospect.url && !/^[a-z]+:\/\//i.test(s.prospect.url)) {
    s.prospect.url = pathToFileURL(join(dir, s.prospect.url)).href
  }
  return s
}

export function listScenarios(root: string): ScenarioInfo[] {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(root, d.name, 'scenario.json')))
    .map((d) => {
      const s = loadScenario(join(root, d.name))
      const last = s.segments[s.segments.length - 1]
      return { id: s.id, titre: s.titre, description: s.description, dureeSec: last ? last.t + last.d : 0 }
    })
}

/** Rejoue les segments d'un scénario en temps (accéléré). */
export class ScenarioPlayer {
  private timers: ReturnType<typeof setTimeout>[] = []
  private done = false

  constructor(
    private scenario: Scenario,
    private speed: number,
    private onSegment: (seg: RawSegment) => void,
    private onEnd: () => void
  ) {}

  start(): void {
    const last = this.scenario.segments[this.scenario.segments.length - 1]
    for (const s of this.scenario.segments) {
      // Le texte arrive à la fin de la prise de parole (comme une vraie transcription).
      const at = ((s.t + s.d) * 1000) / this.speed
      this.timers.push(
        setTimeout(() => this.onSegment({ speaker: s.speaker, startMs: s.t * 1000, endMs: (s.t + s.d) * 1000, text: s.text }), at)
      )
    }
    const endAt = last ? ((last.t + last.d) * 1000) / this.speed + 200 : 0
    this.timers.push(setTimeout(() => this.finish(), endAt))
  }

  stop(): void {
    this.timers.forEach(clearTimeout)
    this.timers = []
    this.finish()
  }

  private finish(): void {
    if (this.done) return
    this.done = true
    this.onEnd()
  }
}
