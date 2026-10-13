'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const info = ipcRenderer.sendSync('get-info');
contextBridge.exposeInMainWorld('native', {
  lang: ipcRenderer.sendSync('get-lang'),
  info,
  setLang: l => ipcRenderer.invoke('set-lang', l),
  ready: () => ipcRenderer.invoke('ready'),
  saveFile: (name, data) => ipcRenderer.invoke('save-file', name, data),
  checkUpdate: url => ipcRenderer.invoke('check-update', url),
  openExternal: url => ipcRenderer.invoke('open-external', url),
  onMenu: cb => ipcRenderer.on('menu', (_e, id) => cb(id)),
  onOpenFile: cb => ipcRenderer.on('open-file', (_e, f) => cb(f))
});
