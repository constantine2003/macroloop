<script>
  import { createEventDispatcher, onMount } from 'svelte'
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

  onMount(async () => {
    if (window.electron) {
      hotkeys = await window.electron.getHotkeys()
      window.electron.onRecordingEvent((event) => {
        recordedEvents = [...recordedEvents, event]
      })
      window.electron.onHotkey((key) => {
        if (key === 'toggle-record') {
          if (state === 'idle') beginCountdown()
          else if (state === 'recording') stopRecording()
        }
        if (key === 'stop' && state === 'recording') stopRecording()
      })
    }
  })

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
    state = 'recording'
    elapsed = 0
    recordedEvents = []
    timerInterval = setInterval(() => elapsed++, 1000)
    if (window.electron) await window.electron.startRecording()
  }

  async function stopRecording() {
    clearInterval(timerInterval)
    state = 'done'
    if (window.electron) {
      const result = await window.electron.stopRecording()
      recordedEvents = result.events
      duration = result.duration
    } else {
      duration = elapsed * 1000
    }
    macroName = `Macro ${new Date().toLocaleTimeString()}`
  }

  function discard() {
    state = 'idle'; recordedEvents = []; macroName = ''; elapsed = 0
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

  function formatTime(s) {
    return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`
  }

  function eventLabel(ev) {
    if (ev.type === 'mousemove') return `Move ${ev.x},${ev.y}`
    if (ev.type === 'mousedown') return `↓ ${ev.button} click`
    if (ev.type === 'mouseup') return `↑ ${ev.button} click`
    if (ev.type === 'keydown') return `↓ ${ev.key}`
    if (ev.type === 'keyup') return `↑ ${ev.key}`
    return ev.type
  }

  function eventBadgeClass(ev) {
    if (ev.type === 'mousemove') return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
    if (ev.type.startsWith('mouse')) return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
    return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
  }

  $: clicks = recordedEvents.filter(e => e.type === 'mousedown').length
  $: keys = recordedEvents.filter(e => e.type === 'keydown').length
  $: moves = recordedEvents.filter(e => e.type === 'mousemove').length
</script>

<svelte:window on:keydown={handleKeyCapture}/>

<div class="h-full flex flex-col overflow-y-auto p-6 gap-5 bg-gray-50 dark:bg-gray-950 animate-fade-in">

  <!-- Header -->
  <div class="flex items-start justify-between">
    <div>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">Record Macro</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Captures mouse movement, clicks & key presses</p>
    </div>
    <button on:click={() => showSettings = !showSettings}
      class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
        {showSettings
          ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
          : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'}">
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
      </svg>
      Settings
    </button>
  </div>

  <!-- Settings -->
  {#if showSettings}
    <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 flex flex-col gap-5 animate-slide-up">

      <!-- Hotkeys -->
      <div>
        <p class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Hotkeys</p>
        <div class="flex flex-col gap-2">
          {#each [['record','Start / Stop Recording'],['play','Play Macro'],['stop','Stop Playback']] as [slot, label]}
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-700 dark:text-gray-300">{label}</span>
              <button on:click={() => startListening(slot)}
                class="px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all min-w-[100px] text-center
                  {listeningFor === slot
                    ? 'bg-indigo-500 text-white animate-pulse'
                    : 'bg-gray-100 dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}">
                {listeningFor === slot ? 'Press key...' : hotkeys[slot] || 'None'}
              </button>
            </div>
          {/each}
        </div>
      </div>

      <!-- Countdown -->
      <div>
        <p class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Countdown Before Recording</p>
        <div class="flex gap-2">
          {#each [0,3,5,10] as val}
            <button on:click={() => countdown = val}
              class="px-4 py-2 rounded-lg text-sm font-bold transition-all
                {countdown === val
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}">
              {val === 0 ? 'Off' : `${val}s`}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <!-- Main card -->
  <div class="flex-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl flex items-center justify-center min-h-[280px] overflow-hidden">

    {#if state === 'idle'}
      <div class="flex flex-col items-center gap-6 animate-fade-in">
        <div class="relative">
          <button on:click={beginCountdown}
            class="w-24 h-24 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center transition-all hover:scale-105 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50">
            <span class="w-8 h-8 rounded-full bg-white block"></span>
          </button>
          <div class="absolute inset-0 rounded-full border-2 border-indigo-400 animate-ripple pointer-events-none"></div>
        </div>
        <div class="text-center">
          <p class="text-sm font-medium text-gray-700 dark:text-gray-300">Click to start recording</p>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">or press <kbd class="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 font-mono text-xs">{hotkeys.record}</kbd></p>
          {#if countdown > 0}
            <p class="text-xs text-amber-500 mt-1">{countdown}s countdown enabled</p>
          {/if}
        </div>
      </div>

    {:else if state === 'countdown'}
      <div class="flex flex-col items-center gap-3 animate-fade-in">
        <div class="text-8xl font-black font-mono text-indigo-600 dark:text-indigo-400 animate-countdown tabular-nums">
          {countdownValue}
        </div>
        <p class="text-sm text-gray-500 dark:text-gray-400">Recording starts in...</p>
      </div>

    {:else if state === 'recording'}
      <div class="w-full p-6 flex flex-col gap-4 animate-fade-in">
        <!-- Top row -->
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <span class="w-2 h-2 rounded-full bg-red-500 animate-blink"></span>
            <span class="text-xs font-bold text-red-600 dark:text-red-400 tracking-widest">REC</span>
          </div>
          <span class="text-3xl font-black font-mono text-gray-900 dark:text-white tabular-nums">{formatTime(elapsed)}</span>
          <button on:click={stopRecording}
            class="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 text-sm font-semibold text-gray-700 dark:text-gray-300 transition-all border border-gray-200 dark:border-gray-700 hover:border-red-200 dark:hover:border-red-800">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
            Stop <kbd class="text-[10px] font-mono opacity-60">{hotkeys.record}</kbd>
          </button>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-4 gap-2">
          {#each [['Moves', moves, 'text-emerald-600 dark:text-emerald-400'],['Clicks', clicks, 'text-red-600 dark:text-red-400'],['Keys', keys, 'text-amber-600 dark:text-amber-400'],['Total', recordedEvents.length, 'text-indigo-600 dark:text-indigo-400']] as [label, val, cls]}
            <div class="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 text-center border border-gray-100 dark:border-gray-800">
              <div class="text-2xl font-black font-mono {cls}">{val}</div>
              <div class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">{label}</div>
            </div>
          {/each}
        </div>

        <!-- Feed -->
        <div class="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-100 dark:border-gray-800">
          <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Live Feed</p>
          <div class="flex flex-col gap-1.5 min-h-[60px]">
            {#each recordedEvents.slice(-6).reverse() as ev, i}
              <div class="flex items-center justify-between" style="opacity: {Math.max(0.2, 1 - i * 0.15)}">
                <span class="text-[11px] font-semibold px-2 py-0.5 rounded-md font-mono {eventBadgeClass(ev)}">{eventLabel(ev)}</span>
                <span class="text-[10px] font-mono text-gray-400">{ev.timestamp}ms</span>
              </div>
            {/each}
            {#if recordedEvents.length === 0}
              <p class="text-xs text-gray-400 font-mono">Waiting for input...</p>
            {/if}
          </div>
        </div>
      </div>

    {:else if state === 'done'}
      <div class="flex flex-col items-center gap-5 p-6 w-full max-w-sm animate-slide-up">
        <div class="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-2xl font-bold">
          ✓
        </div>
        <div class="flex items-center gap-4">
          {#each [['Moves', moves],['Clicks', clicks],['Keys', keys],[formatTime(Math.floor(duration/1000)),'Duration']] as [val, label]}
            <div class="text-center">
              <div class="text-xl font-black font-mono text-gray-900 dark:text-white">{val}</div>
              <div class="text-[10px] text-gray-400 uppercase tracking-wider">{label}</div>
            </div>
            {#if label !== 'Duration'}<div class="w-px h-8 bg-gray-200 dark:bg-gray-700"></div>{/if}
          {/each}
        </div>
        <div class="w-full flex flex-col gap-2">
          <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Macro Name</label>
          <input bind:value={macroName} type="text" placeholder="e.g. Roblox Auto-Farm"
            on:keydown={(e) => e.key === 'Enter' && saveMacro()}
            class="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"/>
          <div class="flex gap-2 mt-1">
            <button on:click={discard}
              class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
              Discard
            </button>
            <button on:click={saveMacro} disabled={!macroName.trim()}
              class="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm">
              Save Macro
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Tips -->
  <div class="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
    <span class="text-amber-500 text-base">⚠️</span>
    <p class="text-xs text-amber-700 dark:text-amber-400">Best for <strong>Roblox, idle games, BlueStacks</strong>. Do NOT use in anti-cheat games like Valorant or CS2.</p>
  </div>
</div>
