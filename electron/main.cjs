const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron')
const path = require('path')
const Store = require('electron-store')

const store = new Store()
const isDev = !app.isPackaged

let mainWindow
let nutjs = null
let uiohook = null
let uIOhookInstance = null
let screenshot = null
let Jimp = null

// nut-js
try {
  nutjs = require('@nut-tree-fork/nut-js')
  nutjs.keyboard.config.autoDelayMs = 0
  nutjs.mouse.config.autoDelayMs = 0
  nutjs.mouse.config.mouseSpeed = 2000
} catch (e) { console.warn('nut-js not available:', e.message) }

// uiohook — global input capture
try {
  uiohook = require('uiohook-napi')
  uIOhookInstance = uiohook.uIOhook
} catch (e) { console.warn('uiohook-napi not available:', e.message) }

// screenshot + jimp — for color detection
try {
  screenshot = require('screenshot-desktop')
  Jimp = require('jimp')
} catch (e) { console.warn('screenshot-desktop/jimp not available:', e.message) }

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900, height: 680, minWidth: 800, minHeight: 600,
    frame: false, titleBarStyle: 'hidden', backgroundColor: '#050510',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false
    }
  })
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    // __dirname is .../resources/app/electron in production
    // so ../dist/index.html = .../resources/app/dist/index.html — correct
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// ─── Hotkeys ──────────────────────────────────────────────────────────────────
let registeredHotkeys = { record: 'F6', play: 'F7', stop: 'F8' }

const hotkeyStringToKeycodes = (str) => {
  if (!str) return null
  const nameToCode = {
    'F1':59,'F2':60,'F3':61,'F4':62,'F5':63,
    'F6':64,'F7':65,'F8':66,'F9':67,'F10':68,
    'F11':87,'F12':88,
    'A':30,'B':48,'C':46,'D':32,'E':18,'F':33,'G':34,'H':35,
    'I':23,'J':36,'K':37,'L':38,'M':50,'N':49,'O':24,'P':25,
    'Q':16,'R':19,'S':31,'T':20,'U':22,'V':47,'W':17,'X':45,
    'Y':21,'Z':44,
    '0':11,'1':2,'2':3,'3':4,'4':5,'5':6,'6':7,'7':8,'8':9,'9':10,
    'Space':57,'Enter':28,'Backspace':14,'Tab':15,'Esc':1,
    'Ctrl':29,'Shift':42,'Alt':56,
  }
  const parts = str.split('+').map(p => p.trim())
  const codes = parts.map(p => nameToCode[p]).filter(Boolean)
  return codes.length ? codes : null
}

let pressedKeys = new Set()

function setupUiohookHotkeys() {
  if (!uIOhookInstance) return

  uIOhookInstance.on('keydown', (e) => {
    pressedKeys.add(e.keycode)

    const check = (action, hotkeyStr) => {
      const codes = hotkeyStringToKeycodes(hotkeyStr)
      if (!codes) return
      if (codes.every(c => pressedKeys.has(c))) {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('hotkey', action)
        }
      }
    }
    check('toggle-record', registeredHotkeys.record)
    check('toggle-play',   registeredHotkeys.play)
    check('stop',          registeredHotkeys.stop)

    if (isRecording) {
      const stopCodes = hotkeyStringToKeycodes(registeredHotkeys.record) || []
      const playCodes = hotkeyStringToKeycodes(registeredHotkeys.play) || []
      const isHotkeyPress = stopCodes.includes(e.keycode) || playCodes.includes(e.keycode)
      if (!isHotkeyPress) {
        const event = { type: 'keydown', keycode: e.keycode, key: keycodeToName(e.keycode), timestamp: Date.now() - recordingStartTime }
        recordedEvents.push(event)
        if (!mainWindow.isDestroyed()) mainWindow.webContents.send('recording-event', event)
      }
    }
  })

  uIOhookInstance.on('keyup', (e) => {
    pressedKeys.delete(e.keycode)
    if (isRecording) {
      const stopCodes = hotkeyStringToKeycodes(registeredHotkeys.record) || []
      const isHotkeyPress = stopCodes.includes(e.keycode)
      if (!isHotkeyPress) {
        const event = { type: 'keyup', keycode: e.keycode, key: keycodeToName(e.keycode), timestamp: Date.now() - recordingStartTime }
        recordedEvents.push(event)
        if (!mainWindow.isDestroyed()) mainWindow.webContents.send('recording-event', event)
      }
    }
  })

  uIOhookInstance.on('mousedown', (e) => {
    if (!isRecording) return
    const btn = e.button === 1 ? 'left' : e.button === 2 ? 'right' : 'middle'
    const event = { type: 'mousedown', button: btn, x: e.x, y: e.y, timestamp: Date.now() - recordingStartTime }

    recordedEvents.push(event)
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send('recording-event', event)

    if (screenshot && Jimp) {
      const captureX = e.x
      const captureY = e.y
      const eventRef = event
      setImmediate(async () => {
        try {
          const imgBuffer = await screenshot({ format: 'png' })
          const img = await Jimp.read(imgBuffer)
          const hex = img.getPixelColor(captureX, captureY)
          const r = (hex >> 24) & 0xff
          const g = (hex >> 16) & 0xff
          const b = (hex >> 8)  & 0xff
          eventRef.color = { r, g, b, hex: `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}` }
        } catch(e) {}
      })
    }
  })

  uIOhookInstance.on('mouseup', (e) => {
    if (!isRecording) return
    const btn = e.button === 1 ? 'left' : e.button === 2 ? 'right' : 'middle'
    const event = { type: 'mouseup', button: btn, x: e.x, y: e.y, timestamp: Date.now() - recordingStartTime }
    recordedEvents.push(event)
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send('recording-event', event)
  })
}

ipcMain.handle('set-hotkeys', (_, hotkeys) => {
  registeredHotkeys = { ...registeredHotkeys, ...hotkeys }
  store.set('hotkeys', registeredHotkeys)
  return { success: true }
})
ipcMain.handle('get-hotkeys', () => store.get('hotkeys', registeredHotkeys))

app.whenReady().then(() => {
  const saved = store.get('hotkeys', null)
  if (saved) registeredHotkeys = saved
  createWindow()
  if (uIOhookInstance) {
    try {
      uIOhookInstance.start()
      setupUiohookHotkeys()
      console.log('uiohook started with hotkey support')
    }
    catch (e) { console.warn('uiohook start failed:', e.message) }
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (uIOhookInstance) try { uIOhookInstance.stop() } catch (e) {}
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

// ─── Color Detection ──────────────────────────────────────────────────────────
async function findColorOnScreen(targetR, targetG, targetB, tolerance = 20) {
  if (!screenshot || !Jimp) return null
  try {
    const imgBuffer = await screenshot({ format: 'png' })
    const img = await Jimp.read(imgBuffer)
    const w = img.getWidth()
    const h = img.getHeight()
    let bestMatch = null
    let bestDist = Infinity
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const hex = img.getPixelColor(x, y)
        const r = (hex >> 24) & 0xff
        const g = (hex >> 16) & 0xff
        const b = (hex >> 8)  & 0xff
        const dist = Math.sqrt(Math.pow(r-targetR,2)+Math.pow(g-targetG,2)+Math.pow(b-targetB,2))
        if (dist < tolerance && dist < bestDist) { bestDist = dist; bestMatch = { x, y } }
      }
    }
    return bestMatch
  } catch (e) { return null }
}

ipcMain.handle('get-pixel-under-mouse', async () => {
  if (!nutjs || !screenshot || !Jimp) return null
  try {
    const pos = await nutjs.mouse.getPosition()
    const imgBuffer = await screenshot({ format: 'png' })
    const img = await Jimp.read(imgBuffer)
    const hex = img.getPixelColor(pos.x, pos.y)
    const r = (hex >> 24) & 0xff
    const g = (hex >> 16) & 0xff
    const b = (hex >> 8)  & 0xff
    return { r, g, b, x: pos.x, y: pos.y, hex: `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}` }
  } catch (e) { return null }
})

// ─── Recording ────────────────────────────────────────────────────────────────
let recordingInterval = null
let recordedEvents = []
let recordingStartTime = null
let lastMousePos = { x: 0, y: 0 }
let isRecording = false

ipcMain.handle('start-recording', async () => {
  isRecording = false
  if (recordingInterval) { clearInterval(recordingInterval); recordingInterval = null }
  if (mainWindow) mainWindow.minimize()
  await new Promise(r => setTimeout(r, 300))
  recordedEvents = []
  lastMousePos = { x: 0, y: 0 }
  recordingStartTime = Date.now()
  if (nutjs) {
    recordingInterval = setInterval(async () => {
      if (!isRecording) return
      try {
        const pos = await nutjs.mouse.getPosition()
        if (!isRecording) return
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
  isRecording = true
  return { success: true, demo: !nutjs && !uIOhookInstance }
})

ipcMain.handle('stop-recording', async () => {
  isRecording = false
  if (recordingInterval) { clearInterval(recordingInterval); recordingInterval = null }
  if (mainWindow) { mainWindow.restore(); mainWindow.focus() }
  const duration = Date.now() - (recordingStartTime || Date.now())
  recordingStartTime = null
  return { events: recordedEvents, duration }
})

// ─── Playback ─────────────────────────────────────────────────────────────────
let isPlaying = false
let playbackId = 0

const keyNameToNutKey = (keyName) => {
  if (!nutjs) return null
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
    'F1': nutjs.Key.F1,  'F2': nutjs.Key.F2,  'F3': nutjs.Key.F3,
    'F4': nutjs.Key.F4,  'F5': nutjs.Key.F5,  'F6': nutjs.Key.F6,
    'F7': nutjs.Key.F7,  'F8': nutjs.Key.F8,  'F9': nutjs.Key.F9,
    'F10': nutjs.Key.F10, 'F11': nutjs.Key.F11, 'F12': nutjs.Key.F12,
    '-': nutjs.Key.Minus, '=': nutjs.Key.Equal,
  }
  return map[keyName] || null
}

ipcMain.handle('start-playback', async (_, { events, loops, speed, cooldown, cooldownMin, cooldownMax, colorTracking, colorTolerance }) => {
  if (!nutjs) return { success: false, error: 'nut-js not available' }
  if (!events || events.length === 0) return { success: false, error: 'No events to play' }

  isPlaying = false
  await new Promise(r => setTimeout(r, 50))
  if (mainWindow) mainWindow.minimize()
  await new Promise(r => setTimeout(r, 300))

  isPlaying = true
  playbackId++
  const myId = playbackId
  let loopCount = 0
  const maxLoops = loops === 0 ? Infinity : loops

  const waitChunked = async (ms) => {
    const chunks = Math.ceil(ms / 16)
    for (let c = 0; c < chunks; c++) {
      if (!isPlaying || playbackId !== myId) return false
      await new Promise(r => setTimeout(r, 16))
    }
    return true
  }

  const playOnce = async () => {
    let currentEvents = [...events]

    if (colorTracking) {
      mainWindow.webContents.send('playback-status', 'SCANNING...')
      const firstColorClick = currentEvents.find(e => e.type === 'mousedown' && e.color)
      if (firstColorClick) {
        let found = null
        let attempts = 0
        while (!found && isPlaying && playbackId === myId && attempts < 15) {
          found = await findColorOnScreen(firstColorClick.color.r, firstColorClick.color.g, firstColorClick.color.b, colorTolerance || 25)
          if (!found) { await new Promise(r => setTimeout(r, 300)); attempts++ }
        }
        if (found) {
          const offsetX = found.x - firstColorClick.x
          const offsetY = found.y - firstColorClick.y
          if (Math.abs(offsetX) > 2 || Math.abs(offsetY) > 2) {
            currentEvents = currentEvents.map(e => {
              if (e.type === 'mousemove' || e.type === 'mousedown' || e.type === 'mouseup') {
                return { ...e, x: e.x + offsetX, y: e.y + offsetY }
              }
              return e
            })
          }
        }
      }
    }

    mainWindow.webContents.send('playback-status', 'RUNNING')

    // Trim trailing mousemoves after last click
    const lastClickIdx = [...currentEvents].map((e,i) => ({e,i})).filter(({e}) => e.type === 'mouseup').pop()
    if (lastClickIdx) currentEvents = currentEvents.slice(0, lastClickIdx.i + 1)

    // Pair mousedown+mouseup into atomic clicks
    const processedEvents = []
    for (let i = 0; i < currentEvents.length; i++) {
      const e = currentEvents[i]
      if (e.type === 'mousedown') {
        const upIdx = currentEvents.findIndex((u, j) => j > i && u.type === 'mouseup' && u.button === e.button)
        if (upIdx !== -1) {
          const up = currentEvents[upIdx]
          const holdDuration = up.timestamp - e.timestamp
          processedEvents.push({ ...e, type: 'click', holdDuration, upIdx })
          continue
        }
      }
      const alreadyPaired = processedEvents.some(p => p.type === 'click' && p.upIdx === i)
      if (!alreadyPaired) processedEvents.push(e)
    }

    const heldKeys = new Set()

    for (let i = 0; i < processedEvents.length; i++) {
      if (!isPlaying || playbackId !== myId) break
      const event = processedEvents[i]
      const prevTimestamp = i === 0 ? event.timestamp : processedEvents[i-1].timestamp
      const delay = i === 0 ? 0 : (event.timestamp - prevTimestamp) / speed
      const ok = await waitChunked(Math.max(0, delay))
      if (!ok) break
      try {
        if (event.type === 'mousemove') {
          await nutjs.mouse.setPosition({ x: event.x, y: event.y })
        } else if (event.type === 'click') {
          await nutjs.mouse.setPosition({ x: event.x, y: event.y })
          await new Promise(r => setTimeout(r, 15))
          const btn = event.button === 'left' ? nutjs.Button.LEFT : nutjs.Button.RIGHT
          await nutjs.mouse.pressButton(btn)
          const hold = Math.min(Math.max(event.holdDuration / speed, 30), 300)
          await new Promise(r => setTimeout(r, hold))
          await nutjs.mouse.releaseButton(btn)
          await new Promise(r => setTimeout(r, 15))
        } else if (event.type === 'keydown') {
          const nutKey = keyNameToNutKey(event.key)
          if (nutKey !== null) { await nutjs.keyboard.pressKey(nutKey); heldKeys.add(nutKey) }
        } else if (event.type === 'keyup') {
          const nutKey = keyNameToNutKey(event.key)
          if (nutKey !== null) { await nutjs.keyboard.releaseKey(nutKey); heldKeys.delete(nutKey) }
        }
      } catch (e) {}
    }

    try { await nutjs.mouse.releaseButton(nutjs.Button.LEFT) } catch(e) {}
    try { await nutjs.mouse.releaseButton(nutjs.Button.RIGHT) } catch(e) {}
    for (const key of heldKeys) { try { await nutjs.keyboard.releaseKey(key) } catch(e) {} }

    if (!isPlaying || playbackId !== myId) return
    loopCount++
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send('playback-loop-done', { loopCount })

    if (isPlaying && playbackId === myId && loopCount < maxLoops) {
      let waitMs = 0
      if (cooldown === 'fixed') waitMs = (cooldownMin || 0) * 1000
      else if (cooldown === 'random') {
        const min = (cooldownMin || 0) * 1000
        const max = (cooldownMax || 5) * 1000
        waitMs = min + Math.random() * (max - min)
      }
      if (waitMs > 0) {
        mainWindow.webContents.send('playback-status', `COOLDOWN ${(waitMs/1000).toFixed(1)}s`)
        const ok = await waitChunked(waitMs)
        if (!ok) return
      }
      if (isPlaying && playbackId === myId) playOnce()
    } else {
      isPlaying = false
      if (!mainWindow.isDestroyed()) {
        mainWindow.restore()
        mainWindow.focus()
        mainWindow.webContents.send('playback-status', 'IDLE')
        mainWindow.webContents.send('playback-finished')
      }
    }
  }

  playOnce()
  return { success: true }
})

ipcMain.handle('stop-playback', async () => {
  isPlaying = false
  playbackId++
  if (nutjs) {
    try { await nutjs.mouse.releaseButton(nutjs.Button.LEFT) } catch(e) {}
    try { await nutjs.mouse.releaseButton(nutjs.Button.RIGHT) } catch(e) {}
    for (const key of [nutjs.Key.LeftShift, nutjs.Key.LeftControl, nutjs.Key.LeftAlt]) {
      try { await nutjs.keyboard.releaseKey(key) } catch(e) {}
    }
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.restore()
    mainWindow.focus()
    mainWindow.webContents.send('playback-status', 'IDLE')
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
