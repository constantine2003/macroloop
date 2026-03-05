<script>
  import { createEventDispatcher, onMount } from 'svelte'
  const dispatch = createEventDispatcher()
  export let macros = []

  // ── State ────────────────────────────────────────────────────────────────────
  let scripts = []
  let currentScript = null
  let scriptName = ''
  let steps = []
  let view = 'list' // 'list' | 'editor' | 'running'

  // ── Runtime ──────────────────────────────────────────────────────────────────
  let isRunning = false
  let currentStepIdx = 0
  let runLog = []
  let stopRequested = false
  let logEl = null

  onMount(async () => {
    await loadScripts()
    window.electron?.onColorPickCountdown((n) => { pickCountdown = n })
  })

  // ── Storage ──────────────────────────────────────────────────────────────────
  async function loadScripts() {
    if (window.electron) scripts = (await window.electron.loadScripts()) || []
  }

  async function saveCurrentScript() {
    if (!scriptName.trim()) return
    const script = {
      id: currentScript?.id || (Date.now().toString(36) + Math.random().toString(36).slice(2)),
      name: scriptName.trim(),
      steps,
      createdAt: currentScript?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    if (window.electron) await window.electron.saveScript(script)
    await loadScripts()
    currentScript = script
    justSaved = true
    setTimeout(() => justSaved = false, 2000)
  }

  async function deleteScript(id) {
    if (window.electron) await window.electron.deleteScript(id)
    await loadScripts()
  }

  async function exportScript(script) {
    if (window.electron) await window.electron.exportScript(script)
  }

  async function importScript() {
    if (!window.electron) return
    const result = await window.electron.importScript()
    if (result.success && result.scripts.length) {
      for (const s of result.scripts) {
        await window.electron.saveScript(s)
      }
      await loadScripts()
    }
  }

  // ── Editor helpers ───────────────────────────────────────────────────────────
  function newScript() {
    currentScript = null
    scriptName = 'SCRIPT_' + Date.now().toString(36).toUpperCase()
    steps = []
    view = 'editor'
  }

  function editScript(script) {
    currentScript = script
    scriptName = script.name
    steps = JSON.parse(JSON.stringify(script.steps))
    view = 'editor'
  }

  function addStep(type) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2)
    const defaults = {
      'run-macro': { macroId: null, macroName: '' },
      'if-color':  { color: '#00ff00', tolerance: 30, foundStep: 'next', notFoundStep: 'next', clickOnFound: false },
      'wait':      { seconds: 2 },
      'goto':      { targetStep: 1 },
      'repeat':    { times: 3, fromStep: 1 },
      'stop':      {},
    }
    steps = [...steps, { id, type, ...defaults[type] }]
  }

  function removeStep(idx) { steps = steps.filter((_, i) => i !== idx) }

  function moveStep(idx, dir) {
    const s = [...steps]
    const t = idx + dir
    if (t < 0 || t >= s.length) return
    ;[s[idx], s[t]] = [s[t], s[idx]]
    steps = s
  }

  function setMacro(idx, macroId) {
    const m = macros.find(m => m.id === macroId)
    steps[idx] = { ...steps[idx], macroId, macroName: m?.name || '' }
    steps = [...steps]
  }

  // ── Runner ───────────────────────────────────────────────────────────────────
  function log(msg, type = 'info') {
    runLog = [...runLog.slice(-99), { msg, type, time: new Date().toLocaleTimeString() }]
    setTimeout(() => { if (logEl) logEl.scrollTop = logEl.scrollHeight }, 50)
  }

  // Interruptible sleep — checks stopRequested every 100ms
  function sleep(ms) {
    return new Promise(resolve => {
      const start = Date.now()
      const tick = () => {
        if (stopRequested || Date.now() - start >= ms) return resolve()
        setTimeout(tick, 100)
      }
      tick()
    })
  }

  // Wait for macro playback to finish — interruptible
  function waitForPlayback() {
    return new Promise(resolve => {
      if (!window.electron) return resolve()
      let done = false
      const finish = () => { if (!done) { done = true; resolve() } }
      window.electron.onPlaybackFinished(finish)
      // Poll stopRequested
      const poll = setInterval(() => {
        if (stopRequested) { clearInterval(poll); finish() }
      }, 100)
    })
  }

  async function runScript() {
    if (!steps.length) return
    isRunning = true
    stopRequested = false
    currentStepIdx = 0
    runLog = []
    view = 'running'
    log('▶ Script started', 'success')

    const repeatCounters = {}

    while (!stopRequested && currentStepIdx >= 0 && currentStepIdx < steps.length) {
      const step = steps[currentStepIdx]
      const stepNum = currentStepIdx + 1

      if (step.type === 'run-macro') {
        const macro = macros.find(m => m.id === step.macroId)
        if (!macro) { log(`Step ${stepNum}: Macro not found!`, 'error'); currentStepIdx++; continue }
        log(`Step ${stepNum}: Running macro "${macro.name}"`, 'info')
        if (window.electron) {
          await window.electron.startPlayback({
            events: macro.events, loops: 1, speed: 1,
            cooldown: 'none', cooldownMin: 0, cooldownMax: 0,
            colorTracking: false, colorTolerance: 25,
            randomDelay: 0, randomDelayMax: 0
          })
          await waitForPlayback()
        }
        if (!stopRequested) log(`Step ${stepNum}: Macro done`, 'success')
        currentStepIdx++

      } else if (step.type === 'if-color') {
        log(`Step ${stepNum}: Scanning for color ${step.color}...`, 'info')
        let found = false
        if (window.electron) {
          const hex = step.color.replace('#', '')
          const r = parseInt(hex.slice(0,2), 16)
          const g = parseInt(hex.slice(2,4), 16)
          const b = parseInt(hex.slice(4,6), 16)
          found = !!(await window.electron.scanForColor({ r, g, b, tolerance: step.tolerance }))
        }
        if (found) {
          if (step.clickOnFound && found.x !== undefined) {
            log(`Step ${stepNum}: Color FOUND — clicking at ${found.x}, ${found.y}`, 'success')
            if (window.electron) await window.electron.clickAt({ x: found.x, y: found.y })
          } else {
            log(`Step ${stepNum}: Color FOUND → ${step.foundStep === 'next' ? 'next step' : 'step ' + step.foundStep}`, 'success')
          }
          currentStepIdx = step.foundStep === 'next' ? currentStepIdx + 1 : parseInt(step.foundStep) - 1
        } else {
          log(`Step ${stepNum}: Color NOT found → ${step.notFoundStep === 'next' ? 'next step' : 'step ' + step.notFoundStep}`, 'warn')
          currentStepIdx = step.notFoundStep === 'next' ? currentStepIdx + 1 : parseInt(step.notFoundStep) - 1
        }

      } else if (step.type === 'wait') {
        log(`Step ${stepNum}: Waiting ${step.seconds}s...`, 'info')
        await sleep(step.seconds * 1000)
        currentStepIdx++

      } else if (step.type === 'goto') {
        log(`Step ${stepNum}: Going to step ${step.targetStep}`, 'info')
        currentStepIdx = step.targetStep - 1

      } else if (step.type === 'repeat') {
        const key = step.id
        if (!repeatCounters[key]) repeatCounters[key] = 0
        repeatCounters[key]++
        if (repeatCounters[key] <= step.times) {
          log(`Step ${stepNum}: Repeat ${repeatCounters[key]}/${step.times} → step ${step.fromStep}`, 'info')
          currentStepIdx = step.fromStep - 1
        } else {
          log(`Step ${stepNum}: Repeat done`, 'success')
          delete repeatCounters[key]
          currentStepIdx++
        }

      } else if (step.type === 'stop') {
        log(`Step ${stepNum}: Stop`, 'warn')
        break
      } else {
        currentStepIdx++
      }

      await sleep(50) // small yield to keep UI responsive
    }

    if (stopRequested) log('■ Stopped by user', 'warn')
    else log('✓ Script finished', 'success')
    isRunning = false
    currentStepIdx = -1
  }

  function stopScript() {
    stopRequested = true
    if (window.electron) window.electron.stopPlayback()
  }

  // ── UI helpers ───────────────────────────────────────────────────────────────
  const STEP_TYPES = [
    { type: 'run-macro', icon: '▶', label: 'RUN MACRO',  color: 'var(--accent)',  desc: 'Play a recorded macro' },
    { type: 'if-color',  icon: '◈', label: 'IF COLOR',   color: 'var(--accent2)', desc: 'Check if color exists on screen' },
    { type: 'wait',      icon: '◷', label: 'WAIT',       color: 'var(--accent3)', desc: 'Pause for X seconds' },
    { type: 'goto',      icon: '↩', label: 'GOTO',       color: 'var(--muted)',   desc: 'Jump to a step' },
    { type: 'repeat',    icon: '↻', label: 'REPEAT',     color: 'var(--accent3)', desc: 'Loop back X times' },
    { type: 'stop',      icon: '■', label: 'STOP',       color: 'var(--accent2)', desc: 'End the script' },
  ]

  function stepInfo(type) { return STEP_TYPES.find(s => s.type === type) || { icon: '?', color: 'var(--muted)', label: type } }

  // ── Eyedropper ──────────────────────────────────────────────────────────────
  let pickingColor = null // index of step being picked
  let justSaved = false
  let pickCountdown = 0

  async function pickColorForStep(idx) {
    pickingColor = idx
    pickCountdown = 3
    if (window.electron) {
      // Countdown happens in main process (3..2..1), then minimizes and captures mouse pos
      const result = await window.electron.pickColorFromScreen()
      if (result) {
        steps[idx] = { ...steps[idx], color: result.hex }
        steps = [...steps]
      }
    }
    pickingColor = null
    pickCountdown = 0
  }
</script>

<div class="h-full flex flex-col overflow-hidden animate-scanin" style="background: var(--bg)">

<!-- ══════════════════════════════════════════════════════ LIST VIEW -->
{#if view === 'list'}
<div class="flex flex-col gap-4 p-5 overflow-y-auto flex-1 min-h-0">
  <div class="flex items-center justify-between">
    <button on:click={() => dispatch('back')}
      class="text-[11px] font-bold tracking-widest uppercase px-3 py-1.5 transition-all"
      style="color: var(--muted); font-family: var(--font-mono); border: 1px solid var(--border)"
      on:mouseenter={(e) => { e.currentTarget.style.color='var(--accent)'; e.currentTarget.style.borderColor='var(--accent)' }}
      on:mouseleave={(e) => { e.currentTarget.style.color='var(--muted)'; e.currentTarget.style.borderColor='var(--border)' }}>
      ◀ BACK
    </button>
    <h1 class="text-lg font-black tracking-widest uppercase" style="color: var(--accent); font-family: var(--font-display); text-shadow: var(--glow)">⬡ SCRIPTS</h1>
    <div class="flex gap-2">
      <button on:click={importScript}
        class="text-[11px] font-bold tracking-widest uppercase px-3 py-1.5 transition-all"
        style="color: var(--muted); font-family: var(--font-mono); border: 1px solid var(--border)"
        on:mouseenter={(e) => { e.currentTarget.style.color='var(--accent3)'; e.currentTarget.style.borderColor='var(--accent3)' }}
        on:mouseleave={(e) => { e.currentTarget.style.color='var(--muted)'; e.currentTarget.style.borderColor='var(--border)' }}>
        ↓ IMPORT
      </button>
      <button on:click={newScript}
        class="text-[11px] font-bold tracking-widest uppercase px-3 py-1.5 transition-all"
        style="color: var(--accent); font-family: var(--font-mono); border: 1px solid var(--accent)"
        on:mouseenter={(e) => { e.currentTarget.style.background='var(--accent)'; e.currentTarget.style.color='var(--bg)' }}
        on:mouseleave={(e) => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--accent)' }}>
        + NEW
      </button>
    </div>
  </div>

  <!-- How it works hint -->
  <div class="p-4 text-[10px] leading-relaxed" style="background: var(--bg2); border: 1px solid var(--border); color: var(--muted); font-family: var(--font-mono)">
    <p class="font-bold mb-1" style="color: var(--accent3)">◆ HOW SCRIPTS WORK</p>
    Scripts let you add <span style="color: var(--accent)">logic</span> to your macros.
    Build a list of steps that run in order — run macros, check for colors on screen, wait, loop, or jump to different steps based on conditions.
    <br/><br/>
    <span style="color: var(--accent)">Example:</span> Run "collect" macro → Wait 2s → If the reward color is visible → Run "claim" macro → Repeat 10 times
  </div>

  {#if scripts.length === 0}
    <div class="flex-1 flex flex-col items-center justify-center gap-4" style="border: 1px solid var(--border); background: var(--bg2)">
      <span class="text-5xl animate-float" style="color: var(--muted)">⬡</span>
      <p class="text-sm font-bold tracking-widest uppercase" style="color: var(--muted); font-family: var(--font-mono)">NO SCRIPTS YET</p>
      <button on:click={newScript}
        class="px-6 py-2 text-[11px] font-bold tracking-widest uppercase transition-all"
        style="color: var(--accent); font-family: var(--font-mono); border: 1px solid var(--accent)"
        on:mouseenter={(e) => { e.currentTarget.style.background='var(--accent)'; e.currentTarget.style.color='var(--bg)' }}
        on:mouseleave={(e) => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--accent)' }}>
        + CREATE FIRST SCRIPT
      </button>
    </div>
  {:else}
    <div class="flex flex-col gap-3">
      {#each scripts as script}
        <article class="flex items-center justify-between p-4 transition-all"
          style="background: var(--bg2); border: 1px solid var(--border)"
          on:mouseenter={(e) => e.currentTarget.style.borderColor='var(--border2)'}
          on:mouseleave={(e) => e.currentTarget.style.borderColor='var(--border)'}>
          <div>
            <p class="text-sm font-bold tracking-wider uppercase" style="color: var(--accent); font-family: var(--font-mono)">{script.name}</p>
            <div class="flex gap-1 mt-1">
              {#each script.steps as s}
                <span class="text-[10px]" style="color: {stepInfo(s.type).color}">{stepInfo(s.type).icon}</span>
              {/each}
            </div>
          </div>
          <div class="flex gap-2">
            <button on:click={() => { editScript(script); setTimeout(runScript, 50) }}
              class="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-all"
              style="color: var(--bg); background: var(--accent); font-family: var(--font-mono)"
              on:mouseenter={(e) => e.currentTarget.style.opacity='0.8'}
              on:mouseleave={(e) => e.currentTarget.style.opacity='1'}>
              ▶ RUN
            </button>
            <button on:click={() => editScript(script)}
              class="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-all"
              style="color: var(--muted); font-family: var(--font-mono); border: 1px solid var(--border)"
              on:mouseenter={(e) => { e.currentTarget.style.color='var(--accent3)'; e.currentTarget.style.borderColor='var(--accent3)' }}
              on:mouseleave={(e) => { e.currentTarget.style.color='var(--muted)'; e.currentTarget.style.borderColor='var(--border)' }}>
              EDIT
            </button>
            <button on:click={() => exportScript(script)}
              class="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-all"
              style="color: var(--muted); font-family: var(--font-mono); border: 1px solid var(--border)"
              on:mouseenter={(e) => { e.currentTarget.style.color='var(--accent3)'; e.currentTarget.style.borderColor='var(--accent3)' }}
              on:mouseleave={(e) => { e.currentTarget.style.color='var(--muted)'; e.currentTarget.style.borderColor='var(--border)' }}>
              ↑ EXPORT
            </button>
            <button on:click={() => deleteScript(script.id)}
              class="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-all"
              style="color: var(--muted); font-family: var(--font-mono); border: 1px solid var(--border)"
              on:mouseenter={(e) => { e.currentTarget.style.color='var(--accent2)'; e.currentTarget.style.borderColor='var(--accent2)' }}
              on:mouseleave={(e) => { e.currentTarget.style.color='var(--muted)'; e.currentTarget.style.borderColor='var(--border)' }}>
              ✕
            </button>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</div>

<!-- ══════════════════════════════════════════════════════ EDITOR VIEW -->
{:else if view === 'editor'}
<div class="flex flex-col h-full overflow-hidden">

  <!-- Top bar -->
  <div class="flex items-center gap-3 px-4 py-3 flex-shrink-0" style="border-bottom: 1px solid var(--border); background: var(--bg2)">
    <button on:click={() => view = 'list'}
      class="text-[11px] font-bold tracking-widest uppercase px-3 py-1.5 flex-shrink-0 transition-all"
      style="color: var(--muted); font-family: var(--font-mono); border: 1px solid var(--border)"
      on:mouseenter={(e) => { e.currentTarget.style.color='var(--accent)'; e.currentTarget.style.borderColor='var(--accent)' }}
      on:mouseleave={(e) => { e.currentTarget.style.color='var(--muted)'; e.currentTarget.style.borderColor='var(--border)' }}>◀</button>
    <input bind:value={scriptName}
      class="flex-1 bg-transparent text-sm font-bold tracking-widest uppercase outline-none min-w-0"
      style="color: var(--accent); font-family: var(--font-mono); border-bottom: 1px solid var(--border)"/>
    <button on:click={saveCurrentScript}
      class="text-[11px] font-bold tracking-widest uppercase px-3 py-1.5 flex-shrink-0 transition-all"
      style="color: var(--accent3); font-family: var(--font-mono); border: 1px solid var(--accent3)"
      on:mouseenter={(e) => { e.currentTarget.style.background='var(--accent3)'; e.currentTarget.style.color='var(--bg)' }}
      on:mouseleave={(e) => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--accent3)' }}>
      SAVE
    </button>
    <button on:click={() => { saveCurrentScript(); setTimeout(runScript, 100) }}
      class="text-[11px] font-bold tracking-widest uppercase px-3 py-1.5 flex-shrink-0 transition-all"
      style="color: var(--bg); background: var(--accent); font-family: var(--font-mono)"
      on:mouseenter={(e) => e.currentTarget.style.opacity='0.8'}
      on:mouseleave={(e) => e.currentTarget.style.opacity='1'}>
      ▶ RUN
    </button>
  </div>

  <!-- Steps -->
  <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-2 min-h-0">
    {#if steps.length === 0}
      <div class="flex flex-col items-center justify-center gap-3 py-16" style="border: 1px dashed var(--border)">
        <p class="text-[11px] tracking-widest" style="color: var(--muted); font-family: var(--font-mono)">NO STEPS YET — ADD STEPS BELOW</p>
      </div>
    {:else}
      {#each steps as step, idx}
        {@const info = stepInfo(step.type)}
        <div class="flex gap-2 items-start p-3" style="background: var(--bg2); border: 1px solid var(--border); border-left: 3px solid {info.color}">

          <!-- Number -->
          <div class="w-6 h-6 flex items-center justify-center text-[10px] font-bold flex-shrink-0"
            style="color: var(--muted); font-family: var(--font-mono); border: 1px solid var(--border)">
            {idx + 1}
          </div>

          <!-- Icon -->
          <span class="text-base flex-shrink-0 leading-6" style="color: {info.color}">{info.icon}</span>

          <!-- Config -->
          <div class="flex-1 flex flex-col gap-2 min-w-0">
            <p class="text-[10px] font-bold tracking-widest uppercase" style="color: {info.color}; font-family: var(--font-mono)">{info.label}</p>

            {#if step.type === 'run-macro'}
              <select bind:value={step.macroId} on:change={(e) => setMacro(idx, e.target.value)}
                class="w-full px-2 py-1.5 text-[10px] font-bold outline-none"
                style="background: var(--bg3); color: var(--text); font-family: var(--font-mono); border: 1px solid var(--border)">
                <option value={null}>-- SELECT A MACRO --</option>
                {#each macros as m}
                  <option value={m.id}>{m.name}</option>
                {/each}
              </select>
              <p class="text-[9px]" style="color: var(--muted); font-family: var(--font-mono)">Plays the selected macro once, then continues to next step.</p>

            {:else if step.type === 'if-color'}
              <div class="flex items-center gap-2 flex-wrap">
                <!-- Color preview swatch -->
                <div class="w-8 h-7 rounded flex-shrink-0" style="background: {step.color}; border: 1px solid var(--border)"></div>
                <span class="text-[10px] font-bold" style="color: var(--muted); font-family: var(--font-mono)">{step.color}</span>
                <!-- Manual color picker -->
                <input type="color" bind:value={step.color}
                  class="w-7 h-7 cursor-pointer opacity-0 absolute"
                  style="pointer-events: none"/>
                <label class="px-2 py-1 text-[9px] font-bold tracking-widest uppercase cursor-pointer transition-all"
                  style="color: var(--muted); font-family: var(--font-mono); border: 1px solid var(--border)">
                  <input type="color" bind:value={step.color} class="sr-only"/>
                  🎨 PICK
                </label>
                <!-- Eyedropper — click from screen -->
                <button on:click={() => pickColorForStep(idx)}
                  class="px-2 py-1 text-[9px] font-bold tracking-widest uppercase transition-all"
                  style="color: {pickingColor === idx ? 'var(--bg)' : 'var(--accent2)'}; font-family: var(--font-mono); border: 1px solid var(--accent2); background: {pickingColor === idx ? 'var(--accent2)' : 'transparent'}"
                  on:mouseenter={(e) => { if(pickingColor !== idx) { e.currentTarget.style.background='var(--accent2)'; e.currentTarget.style.color='var(--bg)' }}}
                  on:mouseleave={(e) => { if(pickingColor !== idx) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--accent2)' }}}>
                  {pickingColor === idx ? (pickCountdown > 0 ? `⏳ HOVER OVER COLOR... ${pickCountdown}` : '📸 CAPTURING...') : '⊕ PICK FROM SCREEN'}
                </button>
                <span class="text-[9px]" style="color: var(--muted); font-family: var(--font-mono)">TOLERANCE</span>
                <input type="range" min="5" max="100" bind:value={step.tolerance} class="w-20" style="accent-color: var(--accent2)"/>
                <span class="text-[10px] font-bold w-6" style="color: var(--accent2); font-family: var(--font-mono)">{step.tolerance}</span>
              </div>
              <div class="flex items-center gap-3 flex-wrap">
                <span class="text-[9px]" style="color: var(--accent); font-family: var(--font-mono)">✓ COLOR FOUND → GO TO STEP</span>
                <input type="text" bind:value={step.foundStep}
                  class="w-16 px-2 py-1 text-[10px] font-bold text-center outline-none"
                  style="background: var(--bg3); color: var(--accent); font-family: var(--font-mono); border: 1px solid var(--border)"
                  placeholder="next"/>
                <span class="text-[9px]" style="color: var(--accent2); font-family: var(--font-mono)">✕ NOT FOUND → GO TO STEP</span>
                <input type="text" bind:value={step.notFoundStep}
                  class="w-16 px-2 py-1 text-[10px] font-bold text-center outline-none"
                  style="background: var(--bg3); color: var(--accent2); font-family: var(--font-mono); border: 1px solid var(--border)"
                  placeholder="next"/>
              </div>
              <div class="flex items-center gap-2 mt-1">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" bind:checked={step.clickOnFound}
                    on:change={() => steps = [...steps]}
                    class="w-3.5 h-3.5 cursor-pointer" style="accent-color: var(--accent2)"/>
                  <span class="text-[10px] font-bold tracking-widest uppercase"
                    style="color: {step.clickOnFound ? 'var(--accent2)' : 'var(--muted)'}; font-family: var(--font-mono)">
                    CLICK ON COLOR WHEN FOUND
                  </span>
                </label>
              </div>
              <p class="text-[9px]" style="color: var(--muted); font-family: var(--font-mono)">Type a step number (e.g. 3) or "next" to continue normally.</p>

            {:else if step.type === 'wait'}
              <div class="flex items-center gap-2">
                <button on:click={() => { step.seconds = Math.max(0.5, +(step.seconds - 0.5).toFixed(1)); steps = [...steps] }}
                  class="w-7 h-7 text-sm font-bold" style="color: var(--muted); font-family: var(--font-mono); border: 1px solid var(--border)">-</button>
                <span class="w-16 text-center text-sm font-black" style="color: var(--accent3); font-family: var(--font-display)">{step.seconds}s</span>
                <button on:click={() => { step.seconds = +(step.seconds + 0.5).toFixed(1); steps = [...steps] }}
                  class="w-7 h-7 text-sm font-bold" style="color: var(--muted); font-family: var(--font-mono); border: 1px solid var(--border)">+</button>
              </div>
              <p class="text-[9px]" style="color: var(--muted); font-family: var(--font-mono)">Pauses the script for this many seconds before continuing.</p>

            {:else if step.type === 'goto'}
              <div class="flex items-center gap-2">
                <span class="text-[9px]" style="color: var(--muted); font-family: var(--font-mono)">JUMP TO STEP</span>
                <input type="number" bind:value={step.targetStep} min="1" max={steps.length}
                  class="w-16 px-2 py-1 text-center text-sm font-bold outline-none"
                  style="background: var(--bg3); color: var(--muted); font-family: var(--font-mono); border: 1px solid var(--border)"/>
              </div>
              <p class="text-[9px]" style="color: var(--muted); font-family: var(--font-mono)">Always jumps to that step — useful for looping back to the beginning.</p>

            {:else if step.type === 'repeat'}
              <div class="flex items-center gap-3 flex-wrap">
                <span class="text-[9px]" style="color: var(--muted); font-family: var(--font-mono)">GO BACK TO STEP</span>
                <input type="number" bind:value={step.fromStep} min="1" max={steps.length}
                  class="w-12 px-2 py-1 text-center text-[10px] font-bold outline-none"
                  style="background: var(--bg3); color: var(--accent3); font-family: var(--font-mono); border: 1px solid var(--border)"/>
                <span class="text-[9px]" style="color: var(--muted); font-family: var(--font-mono)">AND REPEAT</span>
                <input type="number" bind:value={step.times} min="1"
                  class="w-12 px-2 py-1 text-center text-[10px] font-bold outline-none"
                  style="background: var(--bg3); color: var(--accent3); font-family: var(--font-mono); border: 1px solid var(--border)"/>
                <span class="text-[9px]" style="color: var(--muted); font-family: var(--font-mono)">TIMES TOTAL</span>
              </div>
              <p class="text-[9px]" style="color: var(--muted); font-family: var(--font-mono)">Loops back to that step the specified number of times, then continues.</p>

            {:else if step.type === 'stop'}
              <p class="text-[9px]" style="color: var(--muted); font-family: var(--font-mono)">Script ends here. Useful for stopping inside a condition branch.</p>
            {/if}
          </div>

          <!-- Controls -->
          <div class="flex flex-col gap-1 flex-shrink-0">
            <button on:click={() => moveStep(idx, -1)}
              class="w-6 h-6 flex items-center justify-center text-[10px]"
              style="color: var(--muted); border: 1px solid var(--border)">▲</button>
            <button on:click={() => moveStep(idx, 1)}
              class="w-6 h-6 flex items-center justify-center text-[10px]"
              style="color: var(--muted); border: 1px solid var(--border)">▼</button>
            <button on:click={() => removeStep(idx)}
              class="w-6 h-6 flex items-center justify-center text-[10px]"
              style="color: var(--muted); border: 1px solid var(--border)"
              on:mouseenter={(e) => { e.currentTarget.style.color='var(--accent2)'; e.currentTarget.style.borderColor='var(--accent2)' }}
              on:mouseleave={(e) => { e.currentTarget.style.color='var(--muted)'; e.currentTarget.style.borderColor='var(--border)' }}>✕</button>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Add step bar -->
  <div class="flex-shrink-0 px-4 py-3 flex flex-wrap gap-2 items-center" style="border-top: 1px solid var(--border); background: var(--bg2)">
    <span class="text-[9px] font-bold tracking-widest uppercase" style="color: var(--muted); font-family: var(--font-mono)">+ ADD STEP:</span>
    {#each STEP_TYPES as s}
      <button on:click={() => addStep(s.type)}
        class="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-all"
        style="color: {s.color}; font-family: var(--font-mono); border: 1px solid {s.color}55"
        on:mouseenter={(e) => { e.currentTarget.style.background=s.color; e.currentTarget.style.color='var(--bg)' }}
        on:mouseleave={(e) => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color=s.color }}>
        {s.icon} {s.label}
      </button>
    {/each}
  </div>
</div>

<!-- ══════════════════════════════════════════════════════ RUNNING VIEW -->
{:else if view === 'running'}
<div class="flex flex-col h-full overflow-hidden">

  <!-- Header -->
  <div class="flex items-center justify-between px-5 py-3 flex-shrink-0" style="border-bottom: 1px solid var(--border); background: var(--bg2)">
    <div>
      <p class="text-sm font-bold tracking-widest uppercase" style="color: var(--accent); font-family: var(--font-mono)">{scriptName}</p>
      <p class="text-[9px] mt-0.5" style="color: var(--muted); font-family: var(--font-mono)">{steps.length} STEPS</p>
    </div>
    <div class="flex items-center gap-2">
      {#if isRunning}
        <div class="flex items-center gap-2 mr-2">
          <span class="w-2 h-2 rounded-full animate-blink" style="background: var(--accent)"></span>
          <span class="text-[11px] font-bold" style="color: var(--accent); font-family: var(--font-mono)">
            STEP {currentStepIdx + 1} / {steps.length}
          </span>
        </div>
        <button on:click={stopScript}
          class="px-5 py-2 text-[11px] font-bold tracking-widest uppercase"
          style="color: var(--bg); background: var(--accent2); font-family: var(--font-mono)">
          ■ STOP
        </button>
      {:else}
        <button on:click={runScript}
          class="px-4 py-1.5 text-[11px] font-bold tracking-widest uppercase"
          style="color: var(--bg); background: var(--accent); font-family: var(--font-mono)">
          ▶ RUN AGAIN
        </button>
        <button on:click={() => view = 'editor'}
          class="px-4 py-1.5 text-[11px] font-bold tracking-widest uppercase"
          style="color: var(--muted); font-family: var(--font-mono); border: 1px solid var(--border)">
          EDIT
        </button>
        <button on:click={() => view = 'list'}
          class="px-4 py-1.5 text-[11px] font-bold tracking-widest uppercase"
          style="color: var(--muted); font-family: var(--font-mono); border: 1px solid var(--border)">
          ◀ BACK
        </button>
      {/if}
    </div>
  </div>

  <!-- Step pills -->
  <div class="flex-shrink-0 px-4 py-2 flex gap-1 flex-wrap" style="border-bottom: 1px solid var(--border); background: var(--bg2)">
    {#each steps as step, idx}
      {@const info = stepInfo(step.type)}
      <div class="px-2 py-1 text-[9px] font-bold transition-all"
        style="font-family: var(--font-mono);
               background: {idx === currentStepIdx && isRunning ? info.color : 'var(--bg3)'};
               color: {idx === currentStepIdx && isRunning ? 'var(--bg)' : 'var(--muted)'};
               border: 1px solid {idx === currentStepIdx && isRunning ? info.color : 'var(--border)'}">
        {idx+1} {info.icon}
      </div>
    {/each}
  </div>

  <!-- Log -->
  <div bind:this={logEl} class="flex-1 overflow-y-auto p-4 flex flex-col gap-1 min-h-0">
    {#if runLog.length === 0}
      <p class="text-[10px]" style="color: var(--muted); font-family: var(--font-mono)">Waiting to start...</p>
    {:else}
      {#each runLog as entry}
        <div class="flex items-start gap-3 text-[10px]" style="font-family: var(--font-mono)">
          <span style="color: var(--border2); flex-shrink: 0">{entry.time}</span>
          <span style="color: {entry.type==='success' ? 'var(--accent)' : entry.type==='error' ? 'var(--accent2)' : entry.type==='warn' ? 'var(--accent3)' : 'var(--muted)'}; flex-shrink: 0">
            {entry.type==='success' ? '✓' : entry.type==='error' ? '✕' : entry.type==='warn' ? '!' : '·'}
          </span>
          <span style="color: var(--text)">{entry.msg}</span>
        </div>
      {/each}
    {/if}
  </div>
</div>
{/if}

</div>