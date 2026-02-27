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
  let playbackStatus = 'IDLE'

  // Cooldown
  let cooldownType = 'none' // none | fixed | random
  let cooldownFixed = 2
  let cooldownMin = 1
  let cooldownMax = 5

  // Color detection
  let colorEnabled = false
  let colorTarget = null   // { r, g, b, hex }
  let colorTolerance = 20
  let pickingColor = false
  let pickInterval = null

  onMount(() => {
    window.electron?.onPlaybackLoopDone((d) => { loopCount = d.loopCount })
    window.electron?.onPlaybackFinished(() => { state = 'idle'; loopCount = 0; playbackStatus = 'IDLE' })
    window.electron?.onPlaybackStatus((s) => { playbackStatus = s })
    window.electron?.onHotkey((key) => {
      if (key === 'stop' && state === 'playing') stopPlayback()
    })
  })

  async function startPickingColor() {
    pickingColor = true
    // Poll pixel under mouse every 100ms until user clicks
    pickInterval = setInterval(async () => {
      const px = await window.electron?.getPixelUnderMouse()
      if (px) colorTarget = px
    }, 100)
  }

  function confirmColor() {
    clearInterval(pickInterval)
    pickingColor = false
  }

  function clearColor() {
    colorTarget = null
    colorEnabled = false
    clearInterval(pickInterval)
    pickingColor = false
  }

  async function startPlayback() {
    if (!macro) return
    state = 'playing'; loopCount = 0; playbackStatus = 'STARTING...'

    const opts = {
      events: macro.events,
      loops: infiniteLoop ? 0 : loops,
      speed,
      cooldown: cooldownType,
      cooldownMin: cooldownType === 'fixed' ? cooldownFixed : cooldownMin,
      cooldownMax: cooldownMax,
      colorTarget: colorEnabled && colorTarget ? colorTarget : null,
      colorTolerance,
    }

    if (window.electron) {
      const r = await window.electron.startPlayback(opts)
      if (!r.success) { state = 'idle'; alert('ERROR: ' + r.error) }
    } else {
      const max = infiniteLoop ? Infinity : loops
      const iv = setInterval(() => {
        loopCount++
        if (loopCount >= max) { clearInterval(iv); state = 'idle'; loopCount = 0 }
      }, 1500)
    }
  }

  async function stopPlayback() {
    if (window.electron) await window.electron.stopPlayback()
    state = 'idle'; loopCount = 0; playbackStatus = 'IDLE'
  }

  function fmt(ms) { return !ms ? '0s' : ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s` }
</script>

<div class="h-full flex flex-col overflow-hidden animate-scanin" style="background: var(--bg)">
  <div class="flex flex-col gap-4 p-5 overflow-y-auto flex-1 min-h-0 max-h-full">

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
    <!-- Status pill -->
    <div class="px-3 py-1 text-[10px] font-bold tracking-widest"
      style="font-family: var(--font-mono); border: 1px solid var(--border); color: {state === 'playing' ? 'var(--accent)' : 'var(--muted)'}">
      {playbackStatus}
    </div>
  </div>

  {#if !macro}
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

    <!-- Config panel -->
    <div style="background: var(--bg2); border: 1px solid var(--border)">

      <!-- Loop count -->
      <div class="flex items-center justify-between px-5 py-3" style="border-bottom: 1px solid var(--border)">
        <div>
          <p class="text-[11px] font-bold tracking-widest uppercase" style="color: var(--text); font-family: var(--font-mono)">LOOPS</p>
        </div>
        <div class="flex items-center gap-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" bind:checked={infiniteLoop} class="w-3.5 h-3.5 cursor-pointer" style="accent-color: var(--accent)"/>
            <span class="text-[10px] font-bold tracking-widest" style="color: var(--muted); font-family: var(--font-mono)">∞</span>
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
      <div class="flex items-center justify-between px-5 py-3" style="border-bottom: 1px solid var(--border)">
        <p class="text-[11px] font-bold tracking-widest uppercase" style="color: var(--text); font-family: var(--font-mono)">SPEED</p>
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

      <!-- Cooldown -->
      <div class="px-5 py-3" style="border-bottom: 1px solid var(--border)">
        <div class="flex items-center justify-between mb-3">
          <p class="text-[11px] font-bold tracking-widest uppercase" style="color: var(--text); font-family: var(--font-mono)">LOOP COOLDOWN</p>
          <div class="flex gap-1">
            {#each [['none','OFF'],['fixed','FIXED'],['random','RANDOM']] as [val, label]}
              <button on:click={() => cooldownType = val}
                class="px-2 py-1 text-[9px] font-bold tracking-widest transition-all"
                style="font-family: var(--font-mono); background: {cooldownType === val ? 'var(--accent3)' : 'var(--bg3)'}; color: {cooldownType === val ? 'var(--bg)' : 'var(--muted)'}; border: 1px solid {cooldownType === val ? 'var(--accent3)' : 'var(--border)'}">
                {label}
              </button>
            {/each}
          </div>
        </div>
        {#if cooldownType === 'fixed'}
          <div class="flex items-center gap-3">
            <span class="text-[10px]" style="color: var(--muted); font-family: var(--font-mono)">WAIT</span>
            <div class="flex items-center" style="border: 1px solid var(--border)">
              <button on:click={() => cooldownFixed = Math.max(0, cooldownFixed - 0.5)}
                class="w-7 h-7 text-sm font-bold" style="color: var(--muted); font-family: var(--font-mono)"
                on:mouseenter={(e) => e.currentTarget.style.color = 'var(--accent3)'}
                on:mouseleave={(e) => e.currentTarget.style.color = 'var(--muted)'}>−</button>
              <span class="w-12 text-center text-sm font-black" style="color: var(--accent3); font-family: var(--font-display)">{cooldownFixed}s</span>
              <button on:click={() => cooldownFixed = cooldownFixed + 0.5}
                class="w-7 h-7 text-sm font-bold" style="color: var(--muted); font-family: var(--font-mono)"
                on:mouseenter={(e) => e.currentTarget.style.color = 'var(--accent3)'}
                on:mouseleave={(e) => e.currentTarget.style.color = 'var(--muted)'}>+</button>
            </div>
            <span class="text-[10px]" style="color: var(--muted); font-family: var(--font-mono)">BETWEEN LOOPS</span>
          </div>
        {:else if cooldownType === 'random'}
          <div class="flex items-center gap-2">
            <span class="text-[10px]" style="color: var(--muted); font-family: var(--font-mono)">MIN</span>
            <div class="flex items-center" style="border: 1px solid var(--border)">
              <button on:click={() => cooldownMin = Math.max(0, cooldownMin - 0.5)}
                class="w-7 h-7 text-sm font-bold" style="color: var(--muted); font-family: var(--font-mono)"
                on:mouseenter={(e) => e.currentTarget.style.color = 'var(--accent3)'}
                on:mouseleave={(e) => e.currentTarget.style.color = 'var(--muted)'}>−</button>
              <span class="w-12 text-center text-sm font-black" style="color: var(--accent3); font-family: var(--font-display)">{cooldownMin}s</span>
              <button on:click={() => cooldownMin = cooldownMin + 0.5}
                class="w-7 h-7 text-sm font-bold" style="color: var(--muted); font-family: var(--font-mono)"
                on:mouseenter={(e) => e.currentTarget.style.color = 'var(--accent3)'}
                on:mouseleave={(e) => e.currentTarget.style.color = 'var(--muted)'}>+</button>
            </div>
            <span class="text-[10px]" style="color: var(--muted); font-family: var(--font-mono)">MAX</span>
            <div class="flex items-center" style="border: 1px solid var(--border)">
              <button on:click={() => cooldownMax = Math.max(cooldownMin, cooldownMax - 0.5)}
                class="w-7 h-7 text-sm font-bold" style="color: var(--muted); font-family: var(--font-mono)"
                on:mouseenter={(e) => e.currentTarget.style.color = 'var(--accent3)'}
                on:mouseleave={(e) => e.currentTarget.style.color = 'var(--muted)'}>−</button>
              <span class="w-12 text-center text-sm font-black" style="color: var(--accent3); font-family: var(--font-display)">{cooldownMax}s</span>
              <button on:click={() => cooldownMax = cooldownMax + 0.5}
                class="w-7 h-7 text-sm font-bold" style="color: var(--muted); font-family: var(--font-mono)"
                on:mouseenter={(e) => e.currentTarget.style.color = 'var(--accent3)'}
                on:mouseleave={(e) => e.currentTarget.style.color = 'var(--muted)'}>+</button>
            </div>
          </div>
        {/if}
      </div>

      <!-- Color Detection -->
      <div class="px-5 py-3">
        <div class="flex items-center justify-between mb-3">
          <div>
            <p class="text-[11px] font-bold tracking-widest uppercase" style="color: var(--text); font-family: var(--font-mono)">COLOR TRACKING</p>
            <p class="text-[9px] mt-0.5" style="color: var(--muted); font-family: var(--font-mono)">FINDS BUTTON BY COLOR BEFORE EACH LOOP</p>
          </div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" bind:checked={colorEnabled} class="w-3.5 h-3.5 cursor-pointer" style="accent-color: var(--accent2)"/>
            <span class="text-[10px] font-bold" style="color: var(--muted); font-family: var(--font-mono)">{colorEnabled ? 'ON' : 'OFF'}</span>
          </label>
        </div>

        {#if colorEnabled}
          <div class="flex flex-col gap-2">
            <!-- Color picker -->
            {#if !colorTarget}
              <p class="text-[10px]" style="color: var(--muted); font-family: var(--font-mono)">HOVER OVER THE BUTTON IN-GAME THEN CLICK PICK</p>
              {#if pickingColor}
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 border" style="background: {colorTarget?.hex || '#000'}; border-color: var(--border2)"></div>
                  <span class="text-[11px] font-bold" style="color: var(--accent2); font-family: var(--font-mono)">{colorTarget?.hex || 'MOVE MOUSE...'}</span>
                  <button on:click={confirmColor}
                    class="px-3 py-1 text-[10px] font-bold tracking-widest ml-auto"
                    style="background: var(--accent2); color: var(--bg); font-family: var(--font-mono)">
                    LOCK ◆
                  </button>
                </div>
              {:else}
                <button on:click={startPickingColor}
                  class="w-full py-2 text-[10px] font-bold tracking-widest uppercase transition-all"
                  style="background: var(--bg3); color: var(--accent2); border: 1px dashed var(--accent2); font-family: var(--font-mono)"
                  on:mouseenter={(e) => e.currentTarget.style.background = 'var(--bg)'}
                  on:mouseleave={(e) => e.currentTarget.style.background = 'var(--bg3)'}>
                  + PICK COLOR FROM SCREEN
                </button>
              {/if}
            {:else}
              <!-- Color locked -->
              <div class="flex items-center gap-3 p-2" style="background: var(--bg3); border: 1px solid var(--border)">
                <div class="w-8 h-8 border flex-shrink-0" style="background: {colorTarget.hex}; border-color: var(--border2); box-shadow: 0 0 10px {colorTarget.hex}55"></div>
                <div>
                  <p class="text-[11px] font-bold" style="color: var(--accent2); font-family: var(--font-mono)">{colorTarget.hex}</p>
                  <p class="text-[9px]" style="color: var(--muted); font-family: var(--font-mono)">RGB({colorTarget.r},{colorTarget.g},{colorTarget.b}) @ {colorTarget.x},{colorTarget.y}</p>
                </div>
                <button on:click={clearColor} class="ml-auto text-[10px] font-bold px-2 py-1"
                  style="color: var(--muted); font-family: var(--font-mono); border: 1px solid var(--border)"
                  on:mouseenter={(e) => e.currentTarget.style.color = 'var(--accent2)'}
                  on:mouseleave={(e) => e.currentTarget.style.color = 'var(--muted)'}>✕</button>
              </div>
              <!-- Tolerance -->
              <div class="flex items-center gap-3">
                <span class="text-[10px]" style="color: var(--muted); font-family: var(--font-mono)">TOLERANCE</span>
                <input type="range" min="5" max="80" bind:value={colorTolerance} class="flex-1" style="accent-color: var(--accent2)"/>
                <span class="text-[10px] w-8 font-bold" style="color: var(--accent2); font-family: var(--font-mono)">{colorTolerance}</span>
              </div>
              <p class="text-[9px]" style="color: var(--muted); font-family: var(--font-mono)">
                HIGHER TOLERANCE = MATCHES MORE SIMILAR COLORS. LOWER = EXACT MATCH ONLY.
              </p>
            {/if}
          </div>
        {/if}
      </div>
    </div>

    <!-- Playing status -->
    {#if state === 'playing'}
      <div class="flex items-center justify-between px-5 py-3 animate-scanin" style="background: var(--bg2); border: 1px solid var(--accent)">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full animate-blink" style="background: var(--accent)"></span>
          <span class="text-[11px] font-bold tracking-[3px]" style="color: var(--accent); font-family: var(--font-mono)">{playbackStatus}</span>
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
</div>