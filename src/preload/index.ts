import { contextBridge, ipcRenderer } from 'electron'
import type { AutoBuildApi } from './api'

const invoke = (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
function on<T>(channel: string, cb: (v: T) => void): () => void {
  const listener = (_: unknown, v: T) => cb(v)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const api: AutoBuildApi = {
  getState: () => invoke('state:get'),
  onState: (cb) => on('state', cb),
  getData: () => invoke('data:get'),
  onData: (cb) => on('data', cb),
  getSettings: () => invoke('settings:get'),
  saveSettings: (s) => invoke('settings:save', s),
  getKeysStatus: () => invoke('keys:status'),
  setKey: (name, value) => invoke('keys:set', name, value),
  testKeys: () => invoke('keys:test'),
  testClaudeCode: () => invoke('claude-code:test'),
  listScenarios: () => invoke('scenarios:list'),
  listTemplates: () => invoke('templates:list'),
  createRdv: (input) => invoke('rdv:create', input),
  createDemoRdv: (id) => invoke('rdv:demo', id),
  updateRdv: (id, patch) => invoke('rdv:update', id, patch),
  deleteRdv: (id) => invoke('rdv:delete', id),
  prepareRdv: (id) => invoke('rdv:prepare', id),
  updateProspect: (id, patch) => invoke('prospect:update', id, patch),
  openLive: (id, speed) => invoke('live:open', id, speed),
  startLive: () => invoke('live:start'),
  pauseLive: (v) => invoke('live:pause', v),
  finishLive: () => invoke('live:finish'),
  closeLive: () => invoke('live:close'),
  setSpeed: (n) => invoke('live:speed', n),
  setBriefMode: (v) => invoke('live:brief-mode', v),
  setConsent: (v) => invoke('live:consent', v),
  runBriefNow: () => invoke('brief:run'),
  setManual: (rdvId, id, v) => invoke('brief:manual', rdvId, id, v),
  rollback: (t) => invoke('generation:rollback', t),
  cancelAgent: () => invoke('generation:cancel'),
  showMain: () => invoke('window:main'),
  showWidget: () => invoke('widget:show'),
  hideWidget: () => invoke('widget:hide'),
  setWidgetMode: (m) => invoke('widget:mode', m),
  getWidgetMode: () => invoke('widget:get-mode'),
  onWidgetMode: (cb) => on('widget:mode', cb),
  viewMaquette: (id) => invoke('maquette:view', id),
  presentMaquette: (id) => invoke('maquette:present', id),
  restoreVersion: (id, v) => invoke('maquette:restore', id, v),
  openMaquetteFolder: (id) => invoke('maquette:folder', id),
  exportMarkdown: (id) => invoke('export:markdown', id),
  exportPdf: (id) => invoke('export:pdf', id),
  emailText: (id) => invoke('export:email', id),
  chooseFolder: (t) => invoke('dialog:folder', t),
  chooseImage: (t) => invoke('dialog:image', t),
  openExternal: (url) => invoke('shell:open', url),
  sendChunk: (speaker, startMs, endMs, wav) => ipcRenderer.send('audio:chunk', speaker, startMs, endMs, wav),
  sendPcm: (speaker, pcm, atMs) => ipcRenderer.send('audio:pcm', speaker, pcm, atMs),
  sendLevels: (levels) => ipcRenderer.send('audio:levels', levels),
  platform: process.platform
}

contextBridge.exposeInMainWorld('autobuild', api)
