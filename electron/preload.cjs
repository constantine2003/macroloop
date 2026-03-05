const { contextBridge, ipcRenderer } = require('electron')

function on(channel, cb) {
  ipcRenderer.removeAllListeners(channel)
  ipcRenderer.on(channel, (_, ...args) => cb(...args))
}

contextBridge.exposeInMainWorld('electron', {
  startRecording:      ()      => ipcRenderer.invoke('start-recording'),
  stopRecording:       ()      => ipcRenderer.invoke('stop-recording'),
  startPlayback:       (opts)  => ipcRenderer.invoke('start-playback', opts),
  stopPlayback:        ()      => ipcRenderer.invoke('stop-playback'),
  saveMacro:           (macro) => ipcRenderer.invoke('save-macro', macro),
  loadMacros:          ()      => ipcRenderer.invoke('load-macros'),
  deleteMacro:         (id)    => ipcRenderer.invoke('delete-macro', id),
  setHotkeys:          (h)     => ipcRenderer.invoke('set-hotkeys', h),
  getHotkeys:          ()      => ipcRenderer.invoke('get-hotkeys'),
  getPixelUnderMouse:  ()      => ipcRenderer.invoke('get-pixel-under-mouse'),
  exportMacro:         (macro) => ipcRenderer.invoke('export-macro', macro),
  importMacro:         ()      => ipcRenderer.invoke('import-macro'),
  saveScript:          (s)     => ipcRenderer.invoke('save-script', s),
  exportScript:        (s)     => ipcRenderer.invoke('export-script', s),
  importScript:        ()      => ipcRenderer.invoke('import-script'),
  loadScripts:         ()      => ipcRenderer.invoke('load-scripts'),
  deleteScript:        (id)    => ipcRenderer.invoke('delete-script', id),
  scanForColor:        (opts)  => ipcRenderer.invoke('scan-for-color', opts),
  clickAt:             (pos)   => ipcRenderer.invoke('click-at', pos),
  pickColorFromScreen: ()      => ipcRenderer.invoke('pick-color-from-screen'),
  onColorPickCountdown: (cb) => on('color-pick-countdown', cb),

  onHotkey:            (cb) => on('hotkey',            cb),
  onRecordingEvent:    (cb) => on('recording-event',   cb),
  onPlaybackLoopDone:  (cb) => on('playback-loop-done',cb),
  onPlaybackFinished:  (cb) => on('playback-finished', cb),
  onPlaybackStatus:    (cb) => on('playback-status',   cb),

  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close:    () => ipcRenderer.send('window-close'),
})