
    const { contextBridge, ipcRenderer } = require('electron');
    contextBridge.exposeInMainWorld('electronAPI', {
      exitApp: () => ipcRenderer.send('exit-app'),
      detachNote: (noteId) => ipcRenderer.send('detach-note', noteId),
      closeWindow: () => ipcRenderer.send('close-window'),
      openExternal: (url) => ipcRenderer.send('open-external', url)
    });
  