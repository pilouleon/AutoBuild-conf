// Réglages (JSON dans le dossier utilisateur) et clés API chiffrées par le système (safeStorage).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import type { Settings } from '@shared/types'
import { mergeSettings } from './settings-defaults'

type KeyName = 'anthropic' | 'gemini'

export class SettingsStore {
  private settingsFile: string
  private keysFile: string
  private cache: Settings
  private keys: Partial<Record<KeyName, string>> = {}

  constructor() {
    const dir = app.getPath('userData')
    mkdirSync(dir, { recursive: true })
    this.settingsFile = join(dir, 'reglages.json')
    this.keysFile = join(dir, 'cles.json')
    this.cache = mergeSettings(this.readJson<Partial<Settings>>(this.settingsFile))
    this.loadKeys()
  }

  private readJson<T>(file: string): T | undefined {
    try {
      return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : undefined
    } catch {
      return undefined
    }
  }

  get(): Settings {
    return this.cache
  }

  save(s: Settings): Settings {
    this.cache = mergeSettings(s)
    writeFileSync(this.settingsFile, JSON.stringify(this.cache, null, 2), 'utf8')
    return this.cache
  }

  private loadKeys(): void {
    const raw = this.readJson<Partial<Record<KeyName, { enc?: string; plain?: string }>>>(this.keysFile) ?? {}
    for (const k of ['anthropic', 'gemini'] as KeyName[]) {
      const v = raw[k]
      if (!v) continue
      try {
        if (v.enc && safeStorage.isEncryptionAvailable()) this.keys[k] = safeStorage.decryptString(Buffer.from(v.enc, 'base64'))
        else if (v.plain) this.keys[k] = v.plain
      } catch {
        /* clé illisible (autre machine) : ignorée */
      }
    }
    // Variables d'environnement : pratique en développement.
    if (!this.keys.anthropic && process.env.ANTHROPIC_API_KEY) this.keys.anthropic = process.env.ANTHROPIC_API_KEY
    if (!this.keys.gemini && process.env.GEMINI_API_KEY) this.keys.gemini = process.env.GEMINI_API_KEY
  }

  getKeys(): Partial<Record<KeyName, string>> {
    return this.keys
  }

  setKey(name: KeyName, value: string): void {
    const v = value.trim()
    if (v) this.keys[name] = v
    else delete this.keys[name]
    const out: Partial<Record<KeyName, { enc?: string; plain?: string }>> = {}
    for (const k of ['anthropic', 'gemini'] as KeyName[]) {
      const key = this.keys[k]
      if (!key) continue
      out[k] = safeStorage.isEncryptionAvailable() ? { enc: safeStorage.encryptString(key).toString('base64') } : { plain: key }
    }
    writeFileSync(this.keysFile, JSON.stringify(out), { encoding: 'utf8', mode: 0o600 })
  }

  encryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }
}
