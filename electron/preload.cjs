const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  // Recording
  startRecording: () => ipcRenderer.invoke('start-recording'),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),

  // Playback
  startPlayback: (opts) => ipcRenderer.invoke('start-playback', opts),
  stopPlayback: () => ipcRenderer.invoke('stop-playback'),

  // Macros
  saveMacro: (macro) => ipcRenderer.invoke('save-macro', macro),
  loadMacros: () => ipcRenderer.invoke('load-macros'),
  deleteMacro: (id) => ipcRenderer.invoke('delete-macro', id),

  // Hotkeys
  setHotkeys: (hotkeys) => ipcRenderer.invoke('set-hotkeys', hotkeys),
  getHotkeys: () => ipcRenderer.invoke('get-hotkeys'),

  // Events from main
  onHotkey: (cb) => ipcRenderer.on('hotkey', (_, key) => cb(key)),
  onRecordingEvent: (cb) => ipcRenderer.on('recording-event', (_, event) => cb(event)),
  onPlaybackLoopDone: (cb) => ipcRenderer.on('playback-loop-done', (_, data) => cb(data)),
  onPlaybackFinished: (cb) => ipcRenderer.on('playback-finished', () => cb()),

  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
})
