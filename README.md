# MacroLoop

A macro recorder for games and idle apps. Record mouse clicks, keyboard inputs, and mouse movement, then replay them automatically with loops, speed control, and color tracking.

Built for Windows. Works with Rise of Kingdoms, Roblox, Minecraft, BlueStacks, and most idle games.

---

## For Users — Download and Install

### Requirements

- Windows 10 or 11
- The game or app you want to automate

### Installation

1. Go to the [Releases](../../releases) page on GitHub
2. Download the latest `MacroLoop-Setup.exe`
3. Run the installer
4. When Windows asks "Do you want to allow this app to make changes", click **Yes** — MacroLoop needs administrator access to read inputs from games

> MacroLoop runs as Administrator by default. This is required to record and replay inputs in games that also run as Administrator (like most PC game launchers).

---

## How to Use

### Recording a Macro

1. Open MacroLoop
2. Click **RECORD** from the home screen
3. Press **F6** or click the record button — the app will minimize
4. Perform your actions in the game (clicks, key presses, etc.)
5. Press **F6** again to stop recording
6. Give your macro a name and click **SAVE**

### Playing a Macro

1. Click **PLAY** from the home screen
2. Select a saved macro or use Quick Select
3. Configure your options:
   - **Loops** — how many times to repeat (or toggle infinity for non-stop)
   - **Speed** — 0.5x to 3x playback speed
   - **Loop Cooldown** — wait between each loop (fixed seconds or random range)
   - **Color Tracking** — automatically find a button by color even if it moves
4. Click **EXECUTE MACRO** — the app will minimize and start playing
5. Press **F8** at any time to stop

### Color Tracking

Enable this if the button you click moves around between loops (common in idle games and gacha games).

When you recorded the macro, MacroLoop automatically saved the color of every button you clicked. On playback with Color Tracking ON, it scans the screen before each loop and shifts your clicks to wherever that color is now.

- Raise the **Tolerance** slider if the button has a gradient or changes shade slightly
- Lower it if the same color appears in multiple places and it keeps clicking the wrong one
- If color tracking cannot find the button, it falls back to the original recorded position

### Hotkeys

| Key | Action |
|-----|--------|
| F6 | Start / Stop recording |
| F7 | Start playback |
| F8 | Stop playback |

Hotkeys can be changed in the **CONFIG** panel on the Record screen. They work even when another app or game has focus.

---

## For Developers — Running from Source

### Requirements

- Node.js 18 or higher
- npm
- Windows (for full functionality — nut-js and uiohook have native bindings)
- Visual Studio Build Tools (for compiling native modules)

### Setup

```bash
git clone https://github.com/yourusername/macroloop
cd macroloop
npm install
npm run dev
```

> Run your terminal as Administrator, otherwise hotkeys and input capture will not work in games.

### Building the Installer

```bash
npm run build
```

The installer will be output to `dist-electron/MacroLoop Setup 1.0.0.exe`.

### Project Structure

```
macroloop/
  electron/
    main.cjs      — main process: recording, playback, hotkeys, color detection
    preload.cjs   — exposes electron APIs to the renderer
  src/
    App.svelte              — root component, navigation, theme switcher
    app.css                 — 5 themes (CYBER, BUBBLE, TERMINAL, VAPOR, CLEAN)
    components/
      Recorder.svelte       — recording UI
      Player.svelte         — playback UI with cooldown and color tracking
      MacroList.svelte      — saved macros list
  package.json
```

### Key Dependencies

| Package | Purpose |
|---------|---------|
| `@nut-tree-fork/nut-js` | Mouse and keyboard simulation during playback |
| `uiohook-napi` | Global input capture during recording (works even in games) |
| `screenshot-desktop` | Screen capture for color tracking |
| `jimp` | Image processing for color detection |
| `electron-store` | Persistent macro storage |

---

## Known Limitations

- Windows only for full functionality (nut-js native bindings)
- Does not work in games with kernel-level anti-cheat (Valorant, PUBG, etc.)
- Color tracking works best with buttons that have a unique color not found elsewhere on screen

---

## License

MIT
