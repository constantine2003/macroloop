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
  let cooldownType = 'none'
  let cooldownFixed = 2
  let cooldownMin = 1
  let cooldownMax = 5

  // Color tracking
  let colorEnabled = false
  let colorTolerance = 25

  // Random delay per click
  let randomDelay = false
  let randomDelayMin = 0
  let randomDelayMax = 200

  onMount(() => {
    window.electron?.onPlaybackLoopDone((d) => { loopCount = d.loopCount })
    window.electron?.onPlaybackFinished(() => { state = 'idle'; loopCount = 0; playbackStatus = 'IDLE' })
    window.electron?.onPlaybackStatus((s) => { playbackStatus = s })
    window.electron?.onHotkey((key) => {
      if (key === 'stop' && state === 'playing') stopPlayback()
    })
  })

  async function startPlayback() {
    if (!macro) return
    state = 'playing'
    loopCount = 0
    playbackStatus = 'STARTING...'

    const opts = {
      events: macro.events,
      loops: infiniteLoop ? 0 : loops,
      speed,
      cooldown: cooldownType,
      cooldownMin: cooldownType === 'fixed' ? cooldownFixed : cooldownMin,
      cooldownMax,
      colorTracking: colorEnabled,
      colorTolerance,
      randomDelay: randomDelay ? randomDelayMin : 0,
      randomDelayMax: randomDelay ? randomDelayMax : 0,
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
    state = 'idle'
    loopCount = 0
    playbackStatus = 'IDLE'
  }

  function fmt(ms) {
    return !ms ? '0s' : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
  }

  function getMacroColor(macro) {
    if (!macro?.events) return null
    const click = macro.events.find(e => (e.type === 'mousedown' || e.type === 'click') && e.color)
    return click ? click.color.hex : null
  }
</script>

<div class="h-full flex flex-col overflow-hidden animate-scanin" style="background: var(--bg)">
  <div class="flex flex-col gap-4 p-5 overflow-y-auto flex-1 min-h-0">

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
      <div class="px-3 py-1 text-[10px] font-bold tracking-widest"
        style="font-family: var(--font-mono); border: 1px solid var(--border); color: {state === 'playing' ? 'var(--accent)' : 'var(--muted)'}">
        {playbackStatus}
      </div>
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
            {#each macros.slice(0, 4) as m}
              <button on:click={() => dispatch('select', m)}
                class="flex items-center justify-between px-4 py-3 text-left transition-all"
                style="background: var(--bg3); border: 1px solid var(--border)"
                on:mouseenter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                on:mouseleave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}>
                <div class="flex items-center gap-2">
                  {#if getMacroColor(m)}
                    <div class="w-2 h-2 rounded-full" style="background: {getMacroColor(m)}; box-shadow: 0 0 4px {getMacroColor(m)}"></div>
                  {:else}
                    <div class="w-2 h-2 rounded-full" style="background: var(--border2)"></div>
                  {/if}
                  <span class="text-[11px] font-bold tracking-wider" style="color: var(--text); font-family: var(--font-mono)">{m.name}</span>
                </div>
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
          <div class="flex items-center gap-2">
            {#if getMacroColor(macro)}
              <div class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style="background: {getMacroColor(macro)}; box-shadow: 0 0 6px {getMacroColor(macro)}"
                title="Color tracking: {getMacroColor(macro)}"></div>
            {:else}
              <div class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style="background: var(--border2)"
                title="No color data"></div>
            {/if}
            <p class="text-sm font-bold tracking-widest uppercase" style="color: var(--accent); font-family: var(--font-mono)">{macro.name}</p>
          </div>
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

        <!-- Loops -->
        <div class="flex items-center justify-between px-5 py-3" style="border-bottom: 1px solid var(--border)">
          <p class="text-[11px] font-bold tracking-widest uppercase" style="color: var(--text); font-family: var(--font-mono)">LOOPS</p>
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" bind:checked={infiniteLoop} class="w-3.5 h-3.5 cursor-pointer" style="accent-color: var(--accent)"/>
              <span class="text-[10px] font-bold tracking-widest" style="color: var(--muted); font-family: var(--font-mono)">∞</span>
            </label>
            {#if !infiniteLoop}
              <div class="flex items-center" style="border: 1px solid var(--border)">
                <button on:click={() => loops = Math.max(1, loops - 1)}
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
            {#each [0.5, 1, 1.5, 2, 3] as s}
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

        <!-- Random Delay -->
        <div class="px-5 py-3" style="border-bottom: 1px solid var(--border)">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-[11px] font-bold tracking-widest uppercase" style="color: var(--text); font-family: var(--font-mono)">RANDOM DELAY</p>
              <p class="text-[9px] mt-0.5" style="color: var(--muted); font-family: var(--font-mono)">ADDS RANDOM PAUSE BETWEEN CLICKS — MORE HUMAN-LIKE</p>
            </div>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" bind:checked={randomDelay} class="w-3.5 h-3.5 cursor-pointer" style="accent-color: var(--accent3)"/>
              <span class="text-[10px] font-bold" style="color: {randomDelay ? 'var(--accent3)' : 'var(--muted)'}; font-family: var(--font-mono)">{randomDelay ? 'ON' : 'OFF'}</span>
            </label>
          </div>
          {#if randomDelay}
            <div class="mt-3 flex items-center gap-2">
              <span class="text-[10px]" style="color: var(--muted); font-family: var(--font-mono)">MIN</span>
              <div class="flex items-center" style="border: 1px solid var(--border)">
                <button on:click={() => randomDelayMin = Math.max(0, randomDelayMin - 25)}
                  class="w-7 h-7 text-sm font-bold"
                  style="color: var(--muted); font-family: var(--font-mono)">-</button>
                <span class="w-14 text-center text-sm font-black" style="color: var(--accent3); font-family: var(--font-display)">{randomDelayMin}ms</span>
                <button on:click={() => randomDelayMin = Math.min(randomDelayMax, randomDelayMin + 25)}
                  class="w-7 h-7 text-sm font-bold"
                  style="color: var(--muted); font-family: var(--font-mono)">+</button>
              </div>
              <span class="text-[10px]" style="color: var(--muted); font-family: var(--font-mono)">MAX</span>
              <div class="flex items-center" style="border: 1px solid var(--border)">
                <button on:click={() => randomDelayMax = Math.max(randomDelayMin, randomDelayMax - 25)}
                  class="w-7 h-7 text-sm font-bold"
                  style="color: var(--muted); font-family: var(--font-mono)">-</button>
                <span class="w-14 text-center text-sm font-black" style="color: var(--accent3); font-family: var(--font-display)">{randomDelayMax}ms</span>
                <button on:click={() => randomDelayMax = randomDelayMax + 25}
                  class="w-7 h-7 text-sm font-bold"
                  style="color: var(--muted); font-family: var(--font-mono)">+</button>
              </div>
            </div>
          {/if}
        </div>

        <!-- Color Tracking -->
        <div class="px-5 py-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-[11px] font-bold tracking-widest uppercase" style="color: var(--text); font-family: var(--font-mono)">COLOR TRACKING</p>
              <p class="text-[9px] mt-0.5" style="color: var(--muted); font-family: var(--font-mono)">AUTO-FINDS BUTTONS USING COLORS SAVED DURING RECORDING</p>
            </div>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" bind:checked={colorEnabled} class="w-3.5 h-3.5 cursor-pointer" style="accent-color: var(--accent2)"/>
              <span class="text-[10px] font-bold" style="color: {colorEnabled ? 'var(--accent2)' : 'var(--muted)'}; font-family: var(--font-mono)">{colorEnabled ? 'ON' : 'OFF'}</span>
            </label>
          </div>
          {#if colorEnabled}
            <div class="mt-3 flex flex-col gap-2">
              <div class="flex items-center gap-3">
                <span class="text-[10px]" style="color: var(--muted); font-family: var(--font-mono)">TOLERANCE</span>
                <input type="range" min="5" max="80" bind:value={colorTolerance} class="flex-1" style="accent-color: var(--accent2)"/>
                <span class="text-[10px] w-8 font-bold" style="color: var(--accent2); font-family: var(--font-mono)">{colorTolerance}</span>
              </div>
              <p class="text-[9px]" style="color: var(--muted); font-family: var(--font-mono)">
                HIGHER TOLERANCE = MATCHES MORE SIMILAR COLORS. RE-RECORD IF BUTTON COLORS CHANGED.
              </p>
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

      <!-- Action button -->
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