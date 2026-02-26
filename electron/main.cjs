const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron')
const path = require('path')
const Store = require('electron-store')

const store = new Store()
const isDev = process.env.NODE_ENV !== 'production'

let mainWindow
let nutjs = null
let uiohook = null
let uIOhookInstance = null

// Try to load nut-js (playback + mouse position polling)
try {
  nutjs = require('@nut-tree-fork/nut-js')
  nutjs.keyboard.config.autoDelayMs = 0
  nutjs.mouse.config.autoDelayMs = 0
  nutjs.mouse.config.mouseSpeed = 2000
} catch (e) {
  console.warn('nut-js not available:', e.message)
}

// Load uiohook at startup — must be running BEFORE recording starts
// to capture global clicks/keys even when Electron window is not focused
try {
  uiohook = require('uiohook-napi')
  uIOhookInstance = uiohook.uIOhook
} catch (e) {
  console.warn('uiohook-napi not available:', e.message)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#050510',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// ─── Dynamic Hotkey Registration ──────────────────────────────────────────────
let registeredHotkeys = { record: 'F6', play: 'F7', stop: 'F8' }

function registerHotkeys() {
  globalShortcut.unregisterAll()
  const { record, play, stop } = registeredHotkeys
  if (record) globalShortcut.register(record, () => mainWindow.webContents.send('hotkey', 'toggle-record'))
  if (play)   globalShortcut.register(play,   () => mainWindow.webContents.send('hotkey', 'toggle-play'))
  if (stop)   globalShortcut.register(stop,   () => mainWindow.webContents.send('hotkey', 'stop'))
}

ipcMain.handle('set-hotkeys', (_, hotkeys) => {
  registeredHotkeys = { ...registeredHotkeys, ...hotkeys }
  registerHotkeys()
  store.set('hotkeys', registeredHotkeys)
  return { success: true }
})

ipcMain.handle('get-hotkeys', () => store.get('hotkeys', registeredHotkeys))

app.whenReady().then(() => {
  const saved = store.get('hotkeys', null)
  if (saved) registeredHotkeys = saved
  createWindow()
  registerHotkeys()

  // Start uiohook at launch so it can capture global events immediately
  // We start it once and keep it running — just toggle isRecording to gate events
  if (uIOhookInstance) {
    try {
      uIOhookInstance.start()
      console.log('uiohook started globally')
    } catch (e) {
      console.warn('uiohook start failed:', e.message)
    }
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (uIOhookInstance) {
    try { uIOhookInstance.stop() } catch (e) {}
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── Recording State ──────────────────────────────────────────────────────────
let recordingInterval = null
let recordedEvents = []
let recordingStartTime = null
let lastMousePos = { x: 0, y: 0 }
let isRecording = false  // THE single source of truth — all handlers check this

ipcMain.handle('start-recording', async () => {
  // 1. Hard stop any previous recording first
  isRecording = false
  if (recordingInterval) { clearInterval(recordingInterval); recordingInterval = null }

  // 2. Minimize window so user can interact with their game
  if (mainWindow) mainWindow.minimize()

  // 3. Small delay to let minimize animation finish
  await new Promise(r => setTimeout(r, 300))

  // 4. Reset state
  recordedEvents = []
  lastMousePos = { x: 0, y: 0 }
  recordingStartTime = Date.now()

  // 5. Register uiohook listeners (remove old ones first to prevent stacking)
  if (uIOhookInstance) {
    uIOhookInstance.removeAllListeners()

    uIOhookInstance.on('mousedown', (e) => {
      if (!isRecording) return
      const btn = e.button === 1 ? 'left' : e.button === 2 ? 'right' : 'middle'
      const event = { type: 'mousedown', button: btn, x: e.x, y: e.y, timestamp: Date.now() - recordingStartTime }
      recordedEvents.push(event)
      if (!mainWindow.isDestroyed()) mainWindow.webContents.send('recording-event', event)
    })

    uIOhookInstance.on('mouseup', (e) => {
      if (!isRecording) return
      const btn = e.button === 1 ? 'left' : e.button === 2 ? 'right' : 'middle'
      const event = { type: 'mouseup', button: btn, x: e.x, y: e.y, timestamp: Date.now() - recordingStartTime }
      recordedEvents.push(event)
      if (!mainWindow.isDestroyed()) mainWindow.webContents.send('recording-event', event)
    })

    uIOhookInstance.on('keydown', (e) => {
      if (!isRecording) return
      const event = { type: 'keydown', keycode: e.keycode, key: keycodeToName(e.keycode), timestamp: Date.now() - recordingStartTime }
      recordedEvents.push(event)
      if (!mainWindow.isDestroyed()) mainWindow.webContents.send('recording-event', event)
    })

    uIOhookInstance.on('keyup', (e) => {
      if (!isRecording) return
      const event = { type: 'keyup', keycode: e.keycode, key: keycodeToName(e.keycode), timestamp: Date.now() - recordingStartTime }
      recordedEvents.push(event)
      if (!mainWindow.isDestroyed()) mainWindow.webContents.send('recording-event', event)
    })
  }

  // 6. Start mouse movement polling
  if (nutjs) {
    recordingInterval = setInterval(async () => {
      if (!isRecording) return  // hard gate — exits immediately if stopped
      try {
        const pos = await nutjs.mouse.getPosition()
        if (!isRecording) return  // check again after await
        const timestamp = Date.now() - recordingStartTime
        if (pos.x !== lastMousePos.x || pos.y !== lastMousePos.y) {
          lastMousePos = { x: pos.x, y: pos.y }
          const event = { type: 'mousemove', x: pos.x, y: pos.y, timestamp }
          recordedEvents.push(event)
          if (!mainWindow.isDestroyed()) mainWindow.webContents.send('recording-event', event)
        }
      } catch (e) {}
    }, 16)
  }

  // 7. NOW flip the flag — only after everything is set up
  isRecording = true

  return { success: true, demo: !nutjs && !uIOhookInstance }
})

ipcMain.handle('stop-recording', async () => {
  // 1. Flip flag FIRST — immediately blocks all handlers
  isRecording = false

  // 2. Stop polling interval
  if (recordingInterval) { clearInterval(recordingInterval); recordingInterval = null }

  // 3. Remove all uiohook listeners but DON'T stop uiohook (keep it running for next recording)
  if (uIOhookInstance) {
    try { uIOhookInstance.removeAllListeners() } catch (e) {}
  }

  // 4. Restore the window
  if (mainWindow) {
    mainWindow.restore()
    mainWindow.focus()
  }

  const duration = Date.now() - (recordingStartTime || Date.now())
  recordingStartTime = null

  return { events: recordedEvents, duration }
})

// ─── Playback State ───────────────────────────────────────────────────────────
let isPlaying = false
let playbackId = 0

ipcMain.handle('start-playback', async (_, { events, loops, speed }) => {
  if (!nutjs) return { success: false, error: 'nut-js not available' }
  if (!events || events.length === 0) return { success: false, error: 'No events to play' }

  // Stop any previous playback
  isPlaying = false
  await new Promise(r => setTimeout(r, 50))

  // Minimize so macro runs in the background on the game
  if (mainWindow) mainWindow.minimize()
  await new Promise(r => setTimeout(r, 300))

  isPlaying = true
  playbackId++
  const myId = playbackId
  let loopCount = 0
  const maxLoops = loops === 0 ? Infinity : loops

  // Build a nut-js Key map from uiohook keycodes
  // nut-js uses its own Key enum — we map from the key NAME we stored during recording
  const keyNameToNutKey = (keyName) => {
    const map = {
      'A': nutjs.Key.A, 'B': nutjs.Key.B, 'C': nutjs.Key.C, 'D': nutjs.Key.D,
      'E': nutjs.Key.E, 'F': nutjs.Key.F, 'G': nutjs.Key.G, 'H': nutjs.Key.H,
      'I': nutjs.Key.I, 'J': nutjs.Key.J, 'K': nutjs.Key.K, 'L': nutjs.Key.L,
      'M': nutjs.Key.M, 'N': nutjs.Key.N, 'O': nutjs.Key.O, 'P': nutjs.Key.P,
      'Q': nutjs.Key.Q, 'R': nutjs.Key.R, 'S': nutjs.Key.S, 'T': nutjs.Key.T,
      'U': nutjs.Key.U, 'V': nutjs.Key.V, 'W': nutjs.Key.W, 'X': nutjs.Key.X,
      'Y': nutjs.Key.Y, 'Z': nutjs.Key.Z,
      '0': nutjs.Key.Num0, '1': nutjs.Key.Num1, '2': nutjs.Key.Num2,
      '3': nutjs.Key.Num3, '4': nutjs.Key.Num4, '5': nutjs.Key.Num5,
      '6': nutjs.Key.Num6, '7': nutjs.Key.Num7, '8': nutjs.Key.Num8,
      '9': nutjs.Key.Num9,
      'Space': nutjs.Key.Space, 'Enter': nutjs.Key.Return,
      'Backspace': nutjs.Key.Backspace, 'Tab': nutjs.Key.Tab,
      'Shift': nutjs.Key.LeftShift, 'Ctrl': nutjs.Key.LeftControl,
      'Alt': nutjs.Key.LeftAlt, 'Esc': nutjs.Key.Escape,
      'F1': nutjs.Key.F1, 'F2': nutjs.Key.F2, 'F3': nutjs.Key.F3,
      'F4': nutjs.Key.F4, 'F5': nutjs.Key.F5, 'F6': nutjs.Key.F6,
      'F7': nutjs.Key.F7, 'F8': nutjs.Key.F8, 'F9': nutjs.Key.F9,
      'F10': nutjs.Key.F10, 'F11': nutjs.Key.F11, 'F12': nutjs.Key.F12,
      '-': nutjs.Key.Minus, '=': nutjs.Key.Equal,
    }
    return map[keyName] || null
  }

  const playOnce = async () => {
    for (let i = 0; i < events.length; i++) {
      if (!isPlaying || playbackId !== myId) return
      const event = events[i]
      const delay = i === 0 ? 0 : (events[i].timestamp - events[i-1].timestamp) / speed

      // Break delay into 16ms chunks so stop responds instantly
      const chunks = Math.ceil(Math.max(0, delay) / 16)
      for (let c = 0; c < chunks; c++) {
        if (!isPlaying || playbackId !== myId) return
        await new Promise(r => setTimeout(r, 16))
      }

      if (!isPlaying || playbackId !== myId) return

      try {
        if (event.type === 'mousemove') {
          await nutjs.mouse.setPosition({ x: event.x, y: event.y })
        } else if (event.type === 'mousedown') {
          await nutjs.mouse.setPosition({ x: event.x, y: event.y })
          if (event.button === 'left') await nutjs.mouse.pressButton(nutjs.Button.LEFT)
          else if (event.button === 'right') await nutjs.mouse.pressButton(nutjs.Button.RIGHT)
        } else if (event.type === 'mouseup') {
          if (event.button === 'left') await nutjs.mouse.releaseButton(nutjs.Button.LEFT)
          else if (event.button === 'right') await nutjs.mouse.releaseButton(nutjs.Button.RIGHT)
        } else if (event.type === 'keydown') {
          // Use key NAME (e.g. 'A', 'Space') mapped to nut-js Key enum
          // This is correct regardless of keyboard layout
          const nutKey = keyNameToNutKey(event.key)
          if (nutKey !== null) await nutjs.keyboard.pressKey(nutKey)
        } else if (event.type === 'keyup') {
          const nutKey = keyNameToNutKey(event.key)
          if (nutKey !== null) await nutjs.keyboard.releaseKey(nutKey)
        }
      } catch (e) {}
    }

    if (!isPlaying || playbackId !== myId) return

    loopCount++
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send('playback-loop-done', { loopCount })

    if (isPlaying && playbackId === myId && loopCount < maxLoops) {
      await new Promise(r => setTimeout(r, 300))
      if (isPlaying && playbackId === myId) playOnce()
    } else {
      isPlaying = false
      // Restore window when done
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.restore()
        mainWindow.focus()
        mainWindow.webContents.send('playback-finished')
      }
    }
  }

  playOnce()
  return { success: true }
})

ipcMain.handle('stop-playback', async () => {
  isPlaying = false
  playbackId++  // invalidates any running loop immediately
  // Release held buttons just in case
  if (nutjs) {
    try { await nutjs.mouse.releaseButton(nutjs.Button.LEFT) } catch(e) {}
    try { await nutjs.mouse.releaseButton(nutjs.Button.RIGHT) } catch(e) {}
  }
  // Restore window
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.restore()
    mainWindow.focus()
    mainWindow.webContents.send('playback-finished')
  }
  return { success: true }
})

// ─── Macro Storage ────────────────────────────────────────────────────────────
ipcMain.handle('save-macro', async (_, macro) => {
  const macros = store.get('macros', [])
  const existing = macros.findIndex(m => m.id === macro.id)
  if (existing >= 0) macros[existing] = macro
  else macros.push(macro)
  store.set('macros', macros)
  return { success: true }
})
ipcMain.handle('load-macros', async () => store.get('macros', []))
ipcMain.handle('delete-macro', async (_, id) => {
  store.set('macros', store.get('macros', []).filter(m => m.id !== id))
  return { success: true }
})

// ─── Window Controls ──────────────────────────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow.minimize())
ipcMain.on('window-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize())
ipcMain.on('window-close', () => mainWindow.close())

// ─── Keycode Helper ───────────────────────────────────────────────────────────
function keycodeToName(keycode) {
  const map = {
    1:'Esc',2:'1',3:'2',4:'3',5:'4',6:'5',7:'6',8:'7',9:'8',10:'9',11:'0',
    12:'-',13:'=',14:'Backspace',15:'Tab',16:'Q',17:'W',18:'E',19:'R',20:'T',
    21:'Y',22:'U',23:'I',24:'O',25:'P',30:'A',31:'S',32:'D',33:'F',34:'G',
    35:'H',36:'J',37:'K',38:'L',44:'Z',45:'X',46:'C',47:'V',48:'B',49:'N',
    50:'M',28:'Enter',29:'Ctrl',42:'Shift',56:'Alt',57:'Space',
    59:'F1',60:'F2',61:'F3',62:'F4',63:'F5',64:'F6',65:'F7',66:'F8',
    67:'F9',68:'F10',87:'F11',88:'F12'
  }
  return map[keycode] || `Key${keycode}`
}
