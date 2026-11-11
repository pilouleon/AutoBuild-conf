import { contextBridge, ipcRenderer } from 'electron'
import type { AutoBuildApi } from './api'

const invoke = (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args)

const api: AutoBuildApi = {
  getState: () => invoke('state:get'),
  onState: (cb) => {
    const listener = (_: unknown, s: Parameters<typeof cb>[0]) => cb(s)
    ipcRenderer.on('state', listener)
    return () => ipcRenderer.removeListener('state', listener)
  },
  getSettings: () => invoke('settings:get'),
  saveSettings: (s) => invoke('settings:save', s),
  getKeysStatus: () => invoke('keys:status'),
  setKey: (name, value) => invoke('keys:set', name, value),
  testKeys: () => invoke('keys:test'),
  testClaudeCode: () => invoke('claude-code:test'),
  listScenarios: () => invoke('scenarios:list'),
  listTemplates: () => invoke('templates:list'),
  prepare: (p) => invoke('session:prepare', p),
  prepareScenario: (id, speed) => invoke('session:prepare-scenario', id, speed),
  start: () => invoke('session:start'),
  stop: () => invoke('session:stop'),
  finalize: () => invoke('session:finalize'),
  reset: () => invoke('session:reset'),
  setSpeed: (n) => invoke('session:speed', n),
  setBriefMode: (v) => invoke('session:brief-mode', v),
  setConsent: (v) => invoke('session:consent', v),
  setManual: (id, v) => invoke('brief:manual', id, v),
  rollback: (t) => invoke('generation:rollback', t),
  cancelAgent: () => invoke('generation:cancel'),
  runBriefNow: () => invoke('brief:run'),
  openPreview: () => invoke('window:preview'),
  openChecklist: () => invoke('window:checklist'),
  openWorkspace: () => invoke('window:workspace'),
  exportBrief: () => invoke('brief:export'),
  chooseFolder: (t) => invoke('dialog:folder', t),
  chooseImage: (t) => invoke('dialog:image', t),
  sendChunk: (speaker, startMs, endMs, wav) => ipcRenderer.send('audio:chunk', speaker, startMs, endMs, wav),
  sendPcm: (speaker, pcm, atMs) => ipcRenderer.send('audio:pcm', speaker, pcm, atMs),
  sendLevels: (levels) => ipcRenderer.send('audio:levels', levels),
  platform: process.platform
}

contextBridge.exposeInMainWorld('autobuild', api)
