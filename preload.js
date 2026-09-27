const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveVideo: (buffer) => ipcRenderer.invoke('save-video', buffer),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
  onOpenVideo: (callback) => ipcRenderer.on('open-video', (event, path) => callback(path)),
  onSaveRecording: (callback) => ipcRenderer.on('save-recording', () => callback())
});
