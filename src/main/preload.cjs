const { contextBridge, ipcRenderer } = require('electron');

// Apenas operações de domínio; nenhum SQL, filesystem ou canal arbitrário é exposto.
contextBridge.exposeInMainWorld('finance', Object.freeze({
  snapshot: month => ipcRenderer.invoke('finance:snapshot', month),
  execute: (action, payload) => ipcRenderer.invoke('finance:execute', action, payload),
  backup: () => ipcRenderer.invoke('finance:backup')
}));
