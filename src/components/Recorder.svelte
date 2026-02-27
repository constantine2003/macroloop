<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte'
  const dispatch = createEventDispatcher()

  let state = 'idle'
  let recordedEvents = []
  let duration = 0
  let timerInterval = null
  let elapsed = 0
  let macroName = ''
  let showSettings = false
  let countdown = 3
  let countdownValue = 3
  let hotkeys = { record: 'F6', play: 'F7', stop: 'F8' }
  let listeningFor = null

  // Use a module-level flag to prevent stacking ipc listeners
  let listenersRegistered = false

  onMount(async () => {
    if (window.electron) {
      hotkeys = await window.electron.getHotkeys()

      // Only register once — ipcRenderer.on stacks if called multiple times
      if (!listenersRegistered) {
        listenersRegistered = true

        window.electron.onRecordingEvent((event) => {
          recordedEvents = [...recordedEvents, event]
        })

        window.electron.onHotkey((key) => {
          if (key === 'toggle-record') {
            // Read state via a getter since closures capture stale state
            if (currentState === 'idle') beginCountdown()
            else if (currentState === 'recording') stopRecording()
          }
          if (key === 'stop' && currentState === 'recording') stopRecording()
        })
      }
    }
  })

  onDestroy(() => {
    clearInterval(timerInterval)
  })

  // Keep a live reference to state for hotkey handler closures
  let currentState = 'idle'
  $: currentState = state

  function beginCountdown() {
    if (countdown === 0) { startRecording(); return }
    state = 'countdown'
    countdownValue = countdown
    const cd = setInterval(() => {
      countdownValue--
      if (countdownValue <= 0) { clearInterval(cd); startRecording() }
    }, 1000)
  }

  async function startRecording() {
    // Clear any stale timer first
    if (timerInterval) clearInterval(timerInterval)
    state = 'recording'
    elapsed = 0
    recordedEvents = []
    // Start timer immediately and reliably
    timerInterval = setInterval(() => { elapsed = elapsed + 1 }, 1000)
    if (window.electron) await window.electron.startRecording()
  }

  async function stopRecording() {
    clearInterval(timerInterval)
    timerInterval = null
    state = 'done'
    if (window.electron) {
      const r = await window.electron.stopRecording()
      recordedEvents = r.events
      duration = r.duration
    } else {
      duration = elapsed * 1000
    }
    macroName = `MACRO_${Date.now().toString(36).toUpperCase()}`
  }

  function discard() {
    clearInterval(timerInterval)
    timerInterval = null
    state = 'idle'
    recordedEvents = []
    macroName = ''
    elapsed = 0
  }

  function saveMacro() {
    if (!macroName.trim()) return
    dispatch('save', { name: macroName.trim(), events: recordedEvents, duration })
    discard()
  }

  function startListening(slot) { listeningFor = slot }

  function handleKeyCapture(e) {
    if (!listeningFor) return
    e.preventDefault()
    const parts = []
    if (e.ctrlKey) parts.push('Ctrl')
    if (e.shiftKey) parts.push('Shift')
    if (e.altKey) parts.push('Alt')
    const key = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key
    if (!['Control','Shift','Alt'].includes(key)) parts.push(key)
    hotkeys = { ...hotkeys, [listeningFor]: parts.join('+') }
    listeningFor = null
    if (window.electron) window.electron.setHotkeys(hotkeys)
  }

  function fmt(s) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  function evLabel(ev) {
    if (ev.type === 'mousemove') return `MOV ${ev.x},${ev.y}`
    if (ev.type === 'mousedown') return `CLK↓ ${ev.button}`
    if (ev.type === 'mouseup') return `CLK↑ ${ev.button}`
    if (ev.type === 'keydown') return `KEY↓ ${ev.key}`
    if (ev.type === 'keyup') return `KEY↑ ${ev.key}`
    return ev.type
  }

  function evColor(ev) {
    if (ev.type === 'mousemove') return 'var(--accent)'
    if (ev.type.startsWith('mouse')) return 'var(--accent2)'
    return 'var(--accent3)'
  }

  $: clicks = recordedEvents.filter(e => e.type === 'mousedown').length
  $: keys   = recordedEvents.filter(e => e.type === 'keydown').length
  $: moves  = recordedEvents.filter(e => e.type === 'mousemove').length
</script>

<svelte:window on:keydown={handleKeyCapture}/>

<!-- Fixed height, no scroll on outer — scroll only on inner content if needed -->
<div class="flex flex-col h-full overflow-hidden" style="background: var(--bg)">

  <!-- Scrollable inner -->
  <div class="flex flex-col gap-3 p-5 overflow-y-auto flex-1 min-h-0 max-h-full">

    <!-- Top bar -->
    <div class="flex items-center justify-between flex-shrink-0">
      <button on:click={() => dispatch('back')}
        class="text-[11px] font-bold tracking-widest uppercase px-3 py-1.5 transition-all flex-shrink-0"
        style="color: var(--muted); font-family: var(--font-mono); border: 1px solid var(--border)"
        on:mouseenter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
        on:mouseleave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
        ◀ BACK
      </button>
      <h1 class="text-base font-black tracking-widest uppercase" style="color: var(--accent); font-family: var(--font-display); text-shadow: var(--glow)">
        ⬤ RECORD
      </h1>
      <button on:click={() => showSettings = !showSettings}
        class="text-[11px] font-bold tracking-widest uppercase px-3 py-1.5 transition-all flex-shrink-0"
        style="color: {showSettings ? 'var(--accent)' : 'var(--muted)'}; font-family: var(--font-mono); border: 1px solid {showSettings ? 'var(--accent)' : 'var(--border)'}">
        CONFIG
      </button>
    </div>

    <!-- Settings -->
    {#if showSettings}
      <div class="p-4 flex flex-col gap-3 flex-shrink-0" style="background: var(--bg2); border: 1px solid var(--border2)">
        <p class="text-[9px] font-bold tracking-[4px] uppercase" style="color: var(--accent3); font-family: var(--font-mono)">◆ KEYBINDS</p>
        {#each [['record','START/STOP REC'],['play','PLAY MACRO'],['stop','STOP PLAYBACK']] as [slot, label]}
          <div class="flex items-center justify-between">
            <span class="text-[11px] tracking-widest" style="color: var(--muted); font-family: var(--font-mono)">{label}</span>
            <button on:click={() => startListening(slot)}
              class="px-3 py-1 text-[11px] font-bold tracking-widest transition-all min-w-[100px] text-center"
              style="font-family: var(--font-mono); background: {listeningFor === slot ? 'var(--accent)' : 'var(--bg3)'}; color: {listeningFor === slot ? 'var(--bg)' : 'var(--accent)'}; border: 1px solid {listeningFor === slot ? 'var(--accent)' : 'var(--border)'}">
              {listeningFor === slot ? 'PRESS KEY...' : hotkeys[slot] || 'NONE'}
            </button>
          </div>
        {/each}
        <p class="text-[9px] font-bold tracking-[4px] uppercase" style="color: var(--accent3); font-family: var(--font-mono)">◆ COUNTDOWN</p>
        <div class="flex gap-2">
          {#each [0,3,5,10] as val}
            <button on:click={() => countdown = val}
              class="px-4 py-1.5 text-[11px] font-bold tracking-widest transition-all"
              style="font-family: var(--font-mono); background: {countdown === val ? 'var(--accent)' : 'var(--bg3)'}; color: {countdown === val ? 'var(--bg)' : 'var(--muted)'}; border: 1px solid {countdown === val ? 'var(--accent)' : 'var(--border)'}">
              {val === 0 ? 'OFF' : `${val}S`}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Main area — fixed height, doesn't grow/shrink with content -->
    <div class="flex items-center justify-center flex-shrink-0"
      style="background: var(--bg2); border: 1px solid var(--border); height: 300px; overflow: hidden">

      {#if state === 'idle'}
        <div class="flex flex-col items-center gap-5">
          <div class="relative">
            <button on:click={beginCountdown}
              class="w-24 h-24 rounded-full flex items-center justify-center transition-all"
              style="background: var(--bg3); border: 2px solid var(--accent); box-shadow: var(--glow)"
              on:mouseenter={(e) => e.currentTarget.style.opacity = '0.85'}
              on:mouseleave={(e) => e.currentTarget.style.opacity = '1'}>
              <span class="w-9 h-9 rounded-full block" style="background: var(--accent); box-shadow: var(--glow)"></span>
            </button>
            <div class="absolute inset-0 rounded-full animate-ripple" style="border: 1px solid var(--accent); pointer-events: none"></div>
          </div>
          <div class="text-center">
            <p class="text-sm font-bold tracking-widest uppercase" style="color: var(--text); font-family: var(--font-mono)">CLICK TO RECORD</p>
            <p class="text-[10px] mt-1" style="color: var(--muted); font-family: var(--font-mono)">
              OR PRESS <span style="color: var(--accent)">{hotkeys.record}</span>
            </p>
            {#if countdown > 0}
              <p class="text-[10px] mt-1" style="color: var(--accent3); font-family: var(--font-mono)">{countdown}S COUNTDOWN ON</p>
            {/if}
          </div>
        </div>

      {:else if state === 'countdown'}
        <div class="flex flex-col items-center gap-2">
          <div class="text-[100px] font-black leading-none tabular-nums"
            style="color: var(--accent); font-family: var(--font-display); text-shadow: var(--glow)">
            {countdownValue}
          </div>
          <p class="text-[11px] tracking-[4px] uppercase" style="color: var(--muted); font-family: var(--font-mono)">RECORDING IN...</p>
        </div>

      {:else if state === 'recording'}
        <div class="w-full p-4 flex flex-col gap-3">
          <!-- Header row -->
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2 px-2 py-1 flex-shrink-0" style="background: var(--bg3); border: 1px solid var(--accent2)">
              <span class="w-2 h-2 rounded-full animate-blink flex-shrink-0" style="background: var(--accent2)"></span>
              <span class="text-[10px] font-bold tracking-[3px]" style="color: var(--accent2); font-family: var(--font-mono)">REC</span>
            </div>
            <span class="text-3xl font-black tabular-nums" style="color: var(--text); font-family: var(--font-display); text-shadow: var(--glow)">{fmt(elapsed)}</span>
            <button on:click={stopRecording}
              class="ml-auto px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase transition-all flex-shrink-0"
              style="font-family: var(--font-mono); background: var(--bg3); color: var(--text); border: 1px solid var(--border)"
              on:mouseenter={(e) => { e.currentTarget.style.borderColor = 'var(--accent2)'; e.currentTarget.style.color = 'var(--accent2)' }}
              on:mouseleave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)' }}>
              ■ STOP
            </button>
          </div>

          <!-- Stats grid -->
          <div class="grid grid-cols-4 gap-2">
            {#each [['MOVES', moves, 'var(--accent)'],['CLICKS', clicks, 'var(--accent2)'],['KEYS', keys, 'var(--accent3)'],['TOTAL', recordedEvents.length, 'var(--text)']] as [label, val, color]}
              <div class="p-2 text-center" style="background: var(--bg3); border: 1px solid var(--border)">
                <div class="text-xl font-black tabular-nums" style="color: {color}; font-family: var(--font-display)">{val}</div>
                <div class="text-[9px] tracking-widest" style="color: var(--muted); font-family: var(--font-mono)">{label}</div>
              </div>
            {/each}
          </div>

          <!-- Live feed -->
          <div class="p-2" style="background: var(--bg3); border: 1px solid var(--border)">
            <p class="text-[9px] tracking-[3px] uppercase mb-1.5" style="color: var(--muted); font-family: var(--font-mono)">◆ LIVE FEED</p>
            <div class="flex flex-col gap-1" style="min-height: 44px; max-height: 80px; overflow: hidden">
              {#each recordedEvents.slice(-4).reverse() as ev, i}
                <div class="flex items-center justify-between" style="opacity: {Math.max(0.2, 1 - i * 0.22)}">
                  <span class="text-[10px] font-bold truncate" style="color: {evColor(ev)}; font-family: var(--font-mono)">{evLabel(ev)}</span>
                  <span class="text-[9px] flex-shrink-0 ml-2" style="color: var(--muted); font-family: var(--font-mono)">{ev.timestamp}ms</span>
                </div>
              {/each}
              {#if recordedEvents.length === 0}
                <span class="text-[10px] animate-blink" style="color: var(--muted); font-family: var(--font-mono)">WAITING FOR INPUT_</span>
              {/if}
            </div>
          </div>
        </div>

      {:else if state === 'done'}
        <div class="flex flex-col items-center gap-4 p-5 w-full max-w-sm">
          <p class="text-[10px] tracking-[4px] uppercase" style="color: var(--accent); font-family: var(--font-mono)">◆ RECORDING COMPLETE</p>

          <!-- Stats -->
          <div class="grid grid-cols-4 gap-2 w-full">
            {#each [[moves,'MOV'],[clicks,'CLK'],[keys,'KEY'],[fmt(Math.floor(duration/1000)),'DUR']] as [val, label]}
              <div class="text-center p-2" style="border: 1px solid var(--border)">
                <div class="text-base font-black" style="color: var(--accent); font-family: var(--font-display)">{val}</div>
                <div class="text-[9px]" style="color: var(--muted); font-family: var(--font-mono)">{label}</div>
              </div>
            {/each}
          </div>

          <!-- Save form -->
          <div class="w-full flex flex-col gap-2">
            <p class="text-[9px] tracking-[3px] uppercase" style="color: var(--muted); font-family: var(--font-mono)">MACRO NAME</p>
            <input bind:value={macroName} type="text"
              on:keydown={(e) => e.key === 'Enter' && saveMacro()}
              class="w-full px-3 py-2 text-sm font-bold tracking-wider uppercase outline-none transition-all"
              style="background: var(--bg3); border: 1px solid var(--border2); color: var(--text); font-family: var(--font-mono)"
              on:focus={(e) => e.target.style.borderColor = 'var(--accent)'}
              on:blur={(e) => e.target.style.borderColor = 'var(--border2)'}/>
            <div class="flex gap-2">
              <button on:click={discard}
                class="flex-1 py-2 text-[10px] font-bold tracking-widest uppercase transition-all"
                style="background: var(--bg3); color: var(--muted); border: 1px solid var(--border); font-family: var(--font-mono)"
                on:mouseenter={(e) => e.currentTarget.style.color = 'var(--text)'}
                on:mouseleave={(e) => e.currentTarget.style.color = 'var(--muted)'}>
                DISCARD
              </button>
              <button on:click={saveMacro} disabled={!macroName.trim()}
                class="flex-1 py-2 text-[10px] font-bold tracking-widest uppercase transition-all"
                style="background: var(--accent); color: var(--bg); border: 1px solid var(--accent); font-family: var(--font-mono); box-shadow: var(--glow); opacity: {macroName.trim() ? 1 : 0.4}; cursor: {macroName.trim() ? 'pointer' : 'not-allowed'}">
                SAVE ◆
              </button>
            </div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Warning bar -->
    <div class="flex items-center gap-3 px-3 py-2 flex-shrink-0" style="background: var(--bg2); border: 1px solid var(--border)">
      <span class="text-xs flex-shrink-0" style="color: var(--accent3); font-family: var(--font-mono)">⚠</span>
      <p class="text-[10px] tracking-wider truncate" style="color: var(--muted); font-family: var(--font-mono)">
        USE WITH: ROBLOX · MINECRAFT · IDLE GAMES · BLUESTACKS &nbsp;|&nbsp; DO NOT USE IN ANTI-CHEAT GAMES
      </p>
    </div>

  </div>
</div>
