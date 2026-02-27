const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  startRecording: () => ipcRenderer.invoke('start-recording'),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  startPlayback: (opts) => ipcRenderer.invoke('start-playback', opts),
  stopPlayback: () => ipcRenderer.invoke('stop-playback'),
  saveMacro: (macro) => ipcRenderer.invoke('save-macro', macro),
  loadMacros: () => ipcRenderer.invoke('load-macros'),
  deleteMacro: (id) => ipcRenderer.invoke('delete-macro', id),
  setHotkeys: (hotkeys) => ipcRenderer.invoke('set-hotkeys', hotkeys),
  getHotkeys: () => ipcRenderer.invoke('get-hotkeys'),
  getPixelUnderMouse: () => ipcRenderer.invoke('get-pixel-under-mouse'),
  onHotkey: (cb) => ipcRenderer.on('hotkey', (_, key) => cb(key)),
  onRecordingEvent: (cb) => ipcRenderer.on('recording-event', (_, event) => cb(event)),
  onPlaybackLoopDone: (cb) => ipcRenderer.on('playback-loop-done', (_, data) => cb(data)),
  onPlaybackFinished: (cb) => ipcRenderer.on('playback-finished', () => cb()),
  onPlaybackStatus: (cb) => ipcRenderer.on('playback-status', (_, status) => cb(status)),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
})
