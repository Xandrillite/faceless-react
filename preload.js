const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
    handleWindowResize: (callback) => ipcRenderer.on('update-window-resize', callback)
})
