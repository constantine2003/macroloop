<script>
  import { createEventDispatcher, onMount } from 'svelte'
  const dispatch = createEventDispatcher()

  export let macro = null
  export let macros = []

  let state = 'idle'
  let loops = 1
  let speed = 1
  let loopCount = 0
  let infiniteLoop = false

  onMount(() => {
    window.electron?.onPlaybackLoopDone((data) => { loopCount = data.loopCount })
    window.electron?.onPlaybackFinished(() => { state = 'idle'; loopCount = 0 })
    window.electron?.onHotkey((key) => {
      if (key === 'stop' && state === 'playing') stopPlayback()
    })
  })

  async function startPlayback() {
    if (!macro) return
    state = 'playing'
    loopCount = 0
    if (window.electron) {
      const result = await window.electron.startPlayback({ events: macro.events, loops: infiniteLoop ? 0 : loops, speed })
      if (!result.success) { state = 'idle'; alert('Playback failed: ' + result.error) }
    } else {
      // demo
      const max = infiniteLoop ? Infinity : loops
      const iv = setInterval(() => {
        loopCount++
        if (loopCount >= max) { clearInterval(iv); state = 'idle'; loopCount = 0 }
      }, 1500)
    }
  }

  async function stopPlayback() {
    if (window.electron) await window.electron.stopPlayback()
    state = 'idle'
    loopCount = 0
  }

  function fmt(ms) {
    if (!ms) return '0s'
    return ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s`
  }
</script>

<div class="h-full flex flex-col overflow-y-auto p-6 gap-5 bg-gray-50 dark:bg-gray-950 animate-fade-in">

  <div>
    <h1 class="text-xl font-bold text-gray-900 dark:text-white">Play Macro</h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Configure and run your recorded macros</p>
  </div>

  {#if !macro}
    <!-- Empty / quick pick -->
    <div class="flex-1 flex flex-col items-center justify-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 gap-4">
      <div class="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-2xl">▶</div>
      <div class="text-center">
        <p class="font-semibold text-gray-800 dark:text-gray-200">No macro selected</p>
        <p class="text-sm text-gray-400 mt-0.5">Pick one from below or go to Macros tab</p>
      </div>
      {#if macros.length > 0}
        <div class="w-full max-w-xs flex flex-col gap-2 mt-2">
          <p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Quick Pick</p>
          {#each macros.slice(0,4) as m}
            <button on:click={() => dispatch('select', m)}
              class="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all text-left group">
              <span class="text-sm font-semibold text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{m.name}</span>
              <span class="text-[10px] font-mono text-gray-400">{m.eventCount} events</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

  {:else}
    <!-- Macro info -->
    <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 flex items-center justify-between">
      <div>
        <p class="font-bold text-gray-900 dark:text-white">{macro.name}</p>
        <p class="text-xs font-mono text-gray-400 mt-0.5">{macro.eventCount} events · {fmt(macro.duration)}</p>
      </div>
      <button on:click={() => dispatch('select', null)}
        class="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all">
        Change
      </button>
    </div>

    <!-- Config -->
    <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
      <!-- Loop count -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div>
          <p class="text-sm font-semibold text-gray-800 dark:text-gray-200">Loop Count</p>
          <p class="text-xs text-gray-400 mt-0.5">How many times to repeat</p>
        </div>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" bind:checked={infiniteLoop} class="w-4 h-4 accent-indigo-600 cursor-pointer"/>
            <span class="text-sm font-medium text-gray-600 dark:text-gray-400">∞ Infinite</span>
          </label>
          {#if !infiniteLoop}
            <div class="flex items-center gap-0 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800">
              <button on:click={() => loops = Math.max(1, loops-1)}
                class="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-lg font-bold">−</button>
              <span class="w-9 text-center text-sm font-bold font-mono text-gray-900 dark:text-white">{loops}</span>
              <button on:click={() => loops++}
                class="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-lg font-bold">+</button>
            </div>
          {/if}
        </div>
      </div>

      <!-- Speed -->
      <div class="flex items-center justify-between px-5 py-4">
        <div>
          <p class="text-sm font-semibold text-gray-800 dark:text-gray-200">Playback Speed</p>
          <p class="text-xs text-gray-400 mt-0.5">1x = same speed as recorded</p>
        </div>
        <div class="flex gap-1.5">
          {#each [0.5, 1, 1.5, 2, 3] as s}
            <button on:click={() => speed = s}
              class="px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all
                {speed === s
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}">
              {s}x
            </button>
          {/each}
        </div>
      </div>
    </div>

    <!-- Playing status -->
    {#if state === 'playing'}
      <div class="flex items-center justify-between px-5 py-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/50 animate-fade-in">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-blink"></span>
          <span class="text-sm font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">PLAYING</span>
        </div>
        <span class="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400">
          Loop {loopCount}{infiniteLoop ? '' : ` / ${loops}`}
        </span>
      </div>
    {/if}

    <!-- Action button -->
    {#if state === 'idle'}
      <button on:click={startPlayback}
        class="w-full py-4 rounded-2xl text-base font-bold text-white bg-emerald-500 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5 flex items-center justify-center gap-2">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        Run Macro
      </button>
    {:else}
      <button on:click={stopPlayback}
        class="w-full py-4 rounded-2xl text-base font-bold text-white bg-red-500 hover:bg-red-400 transition-all flex items-center justify-center gap-2">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
        Stop Macro
      </button>
    {/if}
  {/if}
</div>
