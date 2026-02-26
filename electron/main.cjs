const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron')
const path = require('path')
const Store = require('electron-store')

const store = new Store()
const isDev = process.env.NODE_ENV !== 'production'

let mainWindow
let nutjs = null
let uiohook = null

// Try to load nut-js (playback)
try {
  nutjs = require('@nut-tree-fork/nut-js')
  nutjs.keyboard.config.autoDelayMs = 0
  nutjs.mouse.config.autoDelayMs = 0
  nutjs.mouse.config.mouseSpeed = 2000
} catch (e) {
  console.warn('nut-js not available:', e.message)
}

// Try to load uiohook (recording clicks + keys)
try {
  uiohook = require('uiohook-napi')
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
    backgroundColor: '#0a0a0f',
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

// Dynamic Hotkey Registration
let registeredHotkeys = { record: 'F6', play: 'F7', stop: 'F8' }

function registerHotkeys() {
  globalShortcut.unregisterAll()
  const { record, play, stop } = registeredHotkeys
  if (record) globalShortcut.register(record, () => mainWindow.webContents.send('hotkey', 'toggle-record'))
  if (play) globalShortcut.register(play, () => mainWindow.webContents.send('hotkey', 'toggle-play'))
  if (stop) globalShortcut.register(stop, () => mainWindow.webContents.send('hotkey', 'stop'))
}

ipcMain.handle('set-hotkeys', (_, hotkeys) => {
  registeredHotkeys = { ...registeredHotkeys, ...hotkeys }
  registerHotkeys()
  store.set('hotkeys', registeredHotkeys)
  return { success: true }
})

ipcMain.handle('get-hotkeys', () => {
  return store.get('hotkeys', registeredHotkeys)
})

app.whenReady().then(() => {
  const saved = store.get('hotkeys', null)
  if (saved) registeredHotkeys = saved
  createWindow()
  registerHotkeys()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (uiohook) try { uiohook.uIOhook.stop() } catch (e) {}
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Recording State
let recordingInterval = null
let recordedEvents = []
let recordingStartTime = null
let lastMousePos = { x: 0, y: 0 }
let uiohookActive = false
let isRecording = false  // single source of truth — gates ALL event handlers

ipcMain.handle('start-recording', async () => {
  // Reset cleanly first
  isRecording = false
  if (recordingInterval) { clearInterval(recordingInterval); recordingInterval = null }
  if (uiohook && uiohookActive) {
    try { uiohook.uIOhook.removeAllListeners(); uiohook.uIOhook.stop(); uiohookActive = false } catch (e) {}
  }

  recordedEvents = []
  recordingStartTime = Date.now()
  lastMousePos = { x: 0, y: 0 }
  isRecording = true  // only set AFTER reset

  if (!nutjs && !uiohook) return { success: true, demo: true }

  // Mouse movement via nut-js polling
  if (nutjs) {
    recordingInterval = setInterval(async () => {
      if (!isRecording) return  // hard gate
      try {
        const pos = await nutjs.mouse.getPosition()
        const timestamp = Date.now() - recordingStartTime
        if (pos.x !== lastMousePos.x || pos.y !== lastMousePos.y) {
          lastMousePos = { x: pos.x, y: pos.y }
          const event = { type: 'mousemove', x: pos.x, y: pos.y, timestamp }
          recordedEvents.push(event)
          mainWindow.webContents.send('recording-event', event)
        }
      } catch (e) {}
    }, 16)
  }

  // Clicks + keyboard via uiohook
  if (uiohook && !uiohookActive) {
    const { uIOhook } = uiohook
    uIOhook.removeAllListeners()

    uIOhook.on('mousedown', (e) => {
      if (!isRecording) return  // hard gate
      const btn = e.button === 1 ? 'left' : e.button === 2 ? 'right' : 'middle'
      const event = { type: 'mousedown', button: btn, x: e.x, y: e.y, timestamp: Date.now() - recordingStartTime }
      recordedEvents.push(event)
      mainWindow.webContents.send('recording-event', event)
    })

    uIOhook.on('mouseup', (e) => {
      if (!isRecording) return  // hard gate
      const btn = e.button === 1 ? 'left' : e.button === 2 ? 'right' : 'middle'
      const event = { type: 'mouseup', button: btn, x: e.x, y: e.y, timestamp: Date.now() - recordingStartTime }
      recordedEvents.push(event)
      mainWindow.webContents.send('recording-event', event)
    })

    uIOhook.on('keydown', (e) => {
      if (!isRecording) return  // hard gate
      const event = { type: 'keydown', keycode: e.keycode, key: keycodeToName(e.keycode), timestamp: Date.now() - recordingStartTime }
      recordedEvents.push(event)
      mainWindow.webContents.send('recording-event', event)
    })

    uIOhook.on('keyup', (e) => {
      if (!isRecording) return  // hard gate
      const event = { type: 'keyup', keycode: e.keycode, key: keycodeToName(e.keycode), timestamp: Date.now() - recordingStartTime }
      recordedEvents.push(event)
      mainWindow.webContents.send('recording-event', event)
    })

    uIOhook.start()
    uiohookActive = true
  }

  return { success: true, demo: false }
})

ipcMain.handle('stop-recording', async () => {
  isRecording = false  // flip FIRST — immediately blocks all handlers

  if (recordingInterval) { clearInterval(recordingInterval); recordingInterval = null }
  if (uiohook && uiohookActive) {
    try {
      uiohook.uIOhook.removeAllListeners()  // remove before stop
      uiohook.uIOhook.stop()
      uiohookActive = false
    } catch (e) {}
  }

  const duration = Date.now() - (recordingStartTime || Date.now())
  recordingStartTime = null
  return { events: recordedEvents, duration }
})

// Playback State
let isPlaying = false

ipcMain.handle('start-playback', async (_, { events, loops, speed }) => {
  if (!nutjs) return { success: false, error: 'nut-js not available' }
  if (!events || events.length === 0) return { success: false, error: 'No events to play' }

  isPlaying = true
  let loopCount = 0
  const maxLoops = loops === 0 ? Infinity : loops

  const playOnce = async () => {
    for (let i = 0; i < events.length; i++) {
      if (!isPlaying) break
      const event = events[i]
      const delay = i === 0 ? 0 : (events[i].timestamp - events[i - 1].timestamp) / speed
      await new Promise(resolve => setTimeout(resolve, Math.max(0, delay)))
      if (!isPlaying) break
      try {
        if (event.type === 'mousemove') await nutjs.mouse.setPosition({ x: event.x, y: event.y })
        else if (event.type === 'mousedown') {
          await nutjs.mouse.setPosition({ x: event.x, y: event.y })
          if (event.button === 'left') await nutjs.mouse.pressButton(nutjs.Button.LEFT)
          else if (event.button === 'right') await nutjs.mouse.pressButton(nutjs.Button.RIGHT)
        }
        else if (event.type === 'mouseup') {
          if (event.button === 'left') await nutjs.mouse.releaseButton(nutjs.Button.LEFT)
          else if (event.button === 'right') await nutjs.mouse.releaseButton(nutjs.Button.RIGHT)
        }
        else if (event.type === 'keydown') await nutjs.keyboard.pressKey(event.keycode)
        else if (event.type === 'keyup') await nutjs.keyboard.releaseKey(event.keycode)
      } catch (e) {}
    }
    loopCount++
    mainWindow.webContents.send('playback-loop-done', { loopCount })
    if (isPlaying && loopCount < maxLoops) {
      await new Promise(resolve => setTimeout(resolve, 300))
      if (isPlaying) playOnce()
    } else {
      isPlaying = false
      mainWindow.webContents.send('playback-finished')
    }
  }

  playOnce()
  return { success: true }
})

ipcMain.handle('stop-playback', async () => {
  isPlaying = false
  return { success: true }
})

// Macro Storage
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

// Window Controls
ipcMain.on('window-minimize', () => mainWindow.minimize())
ipcMain.on('window-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize())
ipcMain.on('window-close', () => mainWindow.close())

// Keycode to name helper
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
