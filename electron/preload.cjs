const { contextBridge, ipcRenderer } = require('electron')

// Helper — clears old listeners before adding new one so they never stack
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

  onHotkey:            (cb) => on('hotkey',            cb),
  onRecordingEvent:    (cb) => on('recording-event',   cb),
  onPlaybackLoopDone:  (cb) => on('playback-loop-done',cb),
  onPlaybackFinished:  (cb) => on('playback-finished', cb),
  onPlaybackStatus:    (cb) => on('playback-status',   cb),

  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close:    () => ipcRenderer.send('window-close'),
})
