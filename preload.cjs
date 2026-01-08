const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    selectImage: () => ipcRenderer.invoke('select-image'),
    startMacro: (config) => ipcRenderer.invoke('start-macro', config),
    stopMacro: () => ipcRenderer.send('stop-macro'),
    onLog: (callback) => ipcRenderer.on('log', (event, msg) => callback(msg)),
    closeApp: () => ipcRenderer.send('close-app'),
    minimizeApp: () => ipcRenderer.send('minimize-app')
});
