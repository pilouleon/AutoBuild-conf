import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Settings } from '@shared/types'

// Modèles par défaut (modifiables dans les Réglages).
// Gemini : identifiants vérifiés sur la documentation Google en novembre 2026.
export function defaultSettings(): Settings {
  return {
    briefProvider: 'claude',
    transcriptionMode: 'tronçons',
    models: {
      geminiTranscription: 'gemini-3.8-flash',
      geminiLive: 'gemini-3.8-live',
      geminiBrief: 'gemini-3.6-flash',
      claudeBrief: 'claude-opus-5-5',
      claudeGenerator: 'claude-opus-5-5'
    },
    briefEffort: 'low',
    generatorEffort: 'medium',
    briefIntervalSec: 25,
    audio: { micDeviceId: 'default', prospectSource: 'system' },
    agence: { nom: '', mention: 'Maquette de travail, données fictives' },
    templatesDir: '',
    workspacesDir: join(homedir(), 'Documents', 'AutoBuild', 'maquettes'),
    generation: { agentEnabled: true, maxAgentMinutes: 4 }
  }
}

export function mergeSettings(saved: Partial<Settings> | undefined): Settings {
  const d = defaultSettings()
  if (!saved) return d
  return {
    ...d,
    ...saved,
    models: { ...d.models, ...saved.models },
    audio: { ...d.audio, ...saved.audio },
    agence: { ...d.agence, ...saved.agence },
    generation: { ...d.generation, ...saved.generation }
  }
}
