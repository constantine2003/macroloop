<script>
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()
  export let macros = []

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  function fmtDur(ms) { return !ms ? '0s' : ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s` }

  // Get the first captured color from macro events, or null if none
  function getMacroColor(macro) {
    if (!macro.events) return null
    const click = macro.events.find(e => (e.type === 'mousedown' || e.type === 'click') && e.color)
    return click ? click.color.hex : null
  }
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
      ▦ MACROS
    </h1>
    <button on:click={() => dispatch('import')}
      class="text-[11px] font-bold tracking-widest uppercase px-3 py-1.5 transition-all"
      style="color: var(--muted); font-family: var(--font-mono); border: 1px solid var(--border)"
      on:mouseenter={(e) => { e.currentTarget.style.color = 'var(--accent3)'; e.currentTarget.style.borderColor = 'var(--accent3)' }}
      on:mouseleave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
      ↓ IMPORT
    </button>
  </div>

  {#if macros.length === 0}
    <div class="flex-1 flex flex-col items-center justify-center gap-4" style="border: 1px solid var(--border); background: var(--bg2)">
      <span class="text-5xl animate-float">🎮</span>
      <p class="text-sm font-bold tracking-widest uppercase" style="color: var(--muted); font-family: var(--font-mono)">NO MACROS FOUND</p>
      <p class="text-[10px]" style="color: var(--muted); font-family: var(--font-mono)">RECORD ONE FIRST</p>
    </div>

  {:else}
    <div class="grid grid-cols-2 gap-3">
      {#each macros as macro}
        <article class="group flex flex-col gap-3 p-4 transition-all"
          style="background: var(--bg2); border: 1px solid var(--border)"
          on:mouseenter={(e) => e.currentTarget.style.borderColor = 'var(--border2)'}
          on:mouseleave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}>

          <!-- Corner deco -->
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-2 flex-1 pr-2">
              {#if getMacroColor(macro)}
                <div class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style="background: {getMacroColor(macro)}; box-shadow: 0 0 6px {getMacroColor(macro)}; border: 1px solid {getMacroColor(macro)}88"
                  title="Color tracking available: {getMacroColor(macro)}">
                </div>
              {:else}
                <div class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style="background: var(--border2); border: 1px solid var(--border)"
                  title="No color data — re-record to enable color tracking">
                </div>
              {/if}
              <p class="text-[12px] font-bold tracking-wider uppercase leading-tight"
                style="color: var(--accent); font-family: var(--font-mono)">{macro.name}</p>
            </div>
            <button on:click={() => dispatch('delete', { id: macro.id })}
              class="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-[10px] font-bold transition-all flex-shrink-0"
              style="color: var(--muted); border: 1px solid var(--border); font-family: var(--font-mono)"
              on:mouseenter={(e) => { e.currentTarget.style.color = 'var(--accent2)'; e.currentTarget.style.borderColor = 'var(--accent2)' }}
              on:mouseleave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
              ✕
            </button>
          </div>

          <!-- Stats row -->
          <div class="flex gap-2 flex-wrap">
            {#each [[macro.eventCount + ' EVT', 'var(--accent)'],[macro.clickCount + ' CLK', 'var(--accent2)'],[macro.keyCount + ' KEY', 'var(--accent3)'], [fmtDur(macro.duration), 'var(--muted)']] as [label, color]}
              <span class="text-[9px] font-bold tracking-widest px-1.5 py-0.5"
                style="color: {color}; font-family: var(--font-mono); border: 1px solid {color}30">
                {label}
              </span>
            {/each}
          </div>

          <p class="text-[9px]" style="color: var(--muted); font-family: var(--font-mono)">{fmtDate(macro.createdAt)}</p>

          <div class="flex gap-2 mt-auto">
            <button on:click={() => dispatch('select', macro)}
              class="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase transition-all"
              style="background: var(--bg3); color: var(--accent); border: 1px solid var(--accent); font-family: var(--font-mono)"
              on:mouseenter={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'var(--bg)' }}
              on:mouseleave={(e) => { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.color = 'var(--accent)' }}>
              ▶ RUN
            </button>
            <button on:click={() => dispatch('export', macro)}
              class="px-3 py-2.5 text-[10px] font-black tracking-widest uppercase transition-all"
              style="background: var(--bg3); color: var(--muted); border: 1px solid var(--border); font-family: var(--font-mono)"
              on:mouseenter={(e) => { e.currentTarget.style.color = 'var(--accent3)'; e.currentTarget.style.borderColor = 'var(--accent3)' }}
              on:mouseleave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
              ↑
            </button>
          </div>
        </article>
      {/each}
    </div>
  {/if}
  </div>
</div>