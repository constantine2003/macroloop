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
    window.electron?.onPlaybackLoopDone((d) => { loopCount = d.loopCount })
    window.electron?.onPlaybackFinished(() => { state = 'idle'; loopCount = 0 })
    window.electron?.onHotkey((key) => {
      if (key === 'stop' && state === 'playing') stopPlayback()
    })
  })

  async function startPlayback() {
    if (!macro) return
    state = 'playing'; loopCount = 0
    if (window.electron) {
      const r = await window.electron.startPlayback({ events: macro.events, loops: infiniteLoop ? 0 : loops, speed })
      if (!r.success) { state = 'idle'; alert('ERROR: ' + r.error) }
    } else {
      const max = infiniteLoop ? Infinity : loops
      const iv = setInterval(() => { loopCount++; if (loopCount >= max) { clearInterval(iv); state = 'idle'; loopCount = 0 } }, 1500)
    }
  }

  async function stopPlayback() {
    if (window.electron) await window.electron.stopPlayback()
    state = 'idle'; loopCount = 0
  }

  function fmt(ms) { return !ms ? '0s' : ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s` }
</script>

<div class="h-full flex flex-col overflow-y-auto p-6 gap-4 animate-scanin" style="background: var(--bg)">

  <!-- Top bar -->
  <div class="flex items-center justify-between">
    <button on:click={() => dispatch('back')}
      class="text-[11px] font-bold tracking-widest uppercase px-3 py-1.5 transition-all"
      style="color: var(--muted); font-family: var(--font-mono); border: 1px solid var(--border)"
      on:mouseenter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--accent)' }}
      on:mouseleave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
      ◀ BACK
    </button>
    <h1 class="text-lg font-black tracking-widest uppercase" style="color: var(--accent); font-family: var(--font-display); text-shadow: var(--glow)">
      ▶ PLAY
    </h1>
    <div class="w-20"></div>
  </div>

  {#if !macro}
    <!-- No macro selected -->
    <div class="flex-1 flex flex-col items-center justify-center gap-5" style="border: 1px solid var(--border); background: var(--bg2)">
      <span class="text-5xl animate-float" style="color: var(--muted)">▶</span>
      <div class="text-center">
        <p class="text-sm font-bold tracking-widest uppercase" style="color: var(--text); font-family: var(--font-mono)">NO MACRO LOADED</p>
        <p class="text-[10px] mt-1" style="color: var(--muted); font-family: var(--font-mono)">SELECT FROM BELOW</p>
      </div>
      {#if macros.length > 0}
        <div class="flex flex-col gap-2 w-full max-w-xs px-4">
          <p class="text-[9px] tracking-[3px] uppercase" style="color: var(--muted); font-family: var(--font-mono)">◆ QUICK SELECT</p>
          {#each macros.slice(0,4) as m}
            <button on:click={() => dispatch('select', m)}
              class="flex items-center justify-between px-4 py-3 text-left transition-all"
              style="background: var(--bg3); border: 1px solid var(--border)"
              on:mouseenter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
              on:mouseleave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}>
              <span class="text-[11px] font-bold tracking-wider" style="color: var(--text); font-family: var(--font-mono)">{m.name}</span>
              <span class="text-[10px]" style="color: var(--muted); font-family: var(--font-mono)">{m.eventCount} EVT</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

  {:else}
    <!-- Macro loaded -->
    <div class="p-4 flex items-center justify-between" style="background: var(--bg2); border: 1px solid var(--border2)">
      <div>
        <p class="text-sm font-bold tracking-widest uppercase" style="color: var(--accent); font-family: var(--font-mono)">{macro.name}</p>
        <p class="text-[10px] mt-1" style="color: var(--muted); font-family: var(--font-mono)">{macro.eventCount} EVENTS · {fmt(macro.duration)}</p>
      </div>
      <button on:click={() => dispatch('select', null)}
        class="text-[10px] font-bold tracking-widest uppercase px-3 py-1 transition-all"
        style="color: var(--muted); font-family: var(--font-mono); border: 1px solid var(--border)"
        on:mouseenter={(e) => e.currentTarget.style.borderColor = 'var(--border2)'}
        on:mouseleave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}>
        CHANGE
      </button>
    </div>

    <!-- Config -->
    <div style="background: var(--bg2); border: 1px solid var(--border)">
      <!-- Loops -->
      <div class="flex items-center justify-between px-5 py-4" style="border-bottom: 1px solid var(--border)">
        <div>
          <p class="text-[11px] font-bold tracking-widest uppercase" style="color: var(--text); font-family: var(--font-mono)">LOOP COUNT</p>
          <p class="text-[9px] mt-1" style="color: var(--muted); font-family: var(--font-mono)">HOW MANY TIMES TO REPEAT</p>
        </div>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" bind:checked={infiniteLoop} class="w-3.5 h-3.5 cursor-pointer" style="accent-color: var(--accent)"/>
            <span class="text-[10px] font-bold tracking-widest" style="color: var(--muted); font-family: var(--font-mono)">∞ INF</span>
          </label>
          {#if !infiniteLoop}
            <div class="flex items-center" style="border: 1px solid var(--border)">
              <button on:click={() => loops = Math.max(1, loops-1)}
                class="w-8 h-8 flex items-center justify-center text-lg font-bold transition-all"
                style="color: var(--muted); font-family: var(--font-mono)"
                on:mouseenter={(e) => e.currentTarget.style.color = 'var(--accent)'}
                on:mouseleave={(e) => e.currentTarget.style.color = 'var(--muted)'}>−</button>
              <span class="w-10 text-center text-sm font-black" style="color: var(--text); font-family: var(--font-display)">{loops}</span>
              <button on:click={() => loops++}
                class="w-8 h-8 flex items-center justify-center text-lg font-bold transition-all"
                style="color: var(--muted); font-family: var(--font-mono)"
                on:mouseenter={(e) => e.currentTarget.style.color = 'var(--accent)'}
                on:mouseleave={(e) => e.currentTarget.style.color = 'var(--muted)'}>+</button>
            </div>
          {/if}
        </div>
      </div>

      <!-- Speed -->
      <div class="flex items-center justify-between px-5 py-4">
        <div>
          <p class="text-[11px] font-bold tracking-widest uppercase" style="color: var(--text); font-family: var(--font-mono)">SPEED</p>
          <p class="text-[9px] mt-1" style="color: var(--muted); font-family: var(--font-mono)">1X = ORIGINAL SPEED</p>
        </div>
        <div class="flex gap-1">
          {#each [0.5,1,1.5,2,3] as s}
            <button on:click={() => speed = s}
              class="px-3 py-1.5 text-[10px] font-bold tracking-widest transition-all"
              style="font-family: var(--font-mono); background: {speed === s ? 'var(--accent)' : 'var(--bg3)'}; color: {speed === s ? 'var(--bg)' : 'var(--muted)'}; border: 1px solid {speed === s ? 'var(--accent)' : 'var(--border)'}">
              {s}X
            </button>
          {/each}
        </div>
      </div>
    </div>

    <!-- Status -->
    {#if state === 'playing'}
      <div class="flex items-center justify-between px-5 py-3 animate-scanin" style="background: var(--bg2); border: 1px solid var(--accent)">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full animate-blink" style="background: var(--accent)"></span>
          <span class="text-[11px] font-bold tracking-[3px]" style="color: var(--accent); font-family: var(--font-mono)">RUNNING</span>
        </div>
        <span class="text-[11px] font-bold" style="color: var(--accent); font-family: var(--font-mono)">
          LOOP {loopCount}{infiniteLoop ? '' : ` / ${loops}`}
        </span>
      </div>
    {/if}

    <!-- Action -->
    {#if state === 'idle'}
      <button on:click={startPlayback}
        class="w-full py-5 text-base font-black tracking-widest uppercase transition-all"
        style="background: var(--accent); color: var(--bg); font-family: var(--font-display); box-shadow: var(--glow)"
        on:mouseenter={(e) => e.currentTarget.style.opacity = '0.85'}
        on:mouseleave={(e) => e.currentTarget.style.opacity = '1'}>
        ▶▶ EXECUTE MACRO
      </button>
    {:else}
      <button on:click={stopPlayback}
        class="w-full py-5 text-base font-black tracking-widest uppercase transition-all"
        style="background: var(--accent2); color: var(--bg); font-family: var(--font-display); box-shadow: var(--glow2)"
        on:mouseenter={(e) => e.currentTarget.style.opacity = '0.85'}
        on:mouseleave={(e) => e.currentTarget.style.opacity = '1'}>
        ■ TERMINATE
      </button>
    {/if}
  {/if}
</div>