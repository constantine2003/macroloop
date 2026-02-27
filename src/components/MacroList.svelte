<script>
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()
  export let macros = []

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  function fmtDur(ms) { return !ms ? '0s' : ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s` }
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
    <div class="text-[11px] font-bold tracking-widest" style="color: var(--muted); font-family: var(--font-mono)">
      {macros.length} SAVED
    </div>
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
        <div class="group flex flex-col gap-3 p-4 transition-all"
          style="background: var(--bg2); border: 1px solid var(--border)"
          on:mouseenter={(e) => e.currentTarget.style.borderColor = 'var(--border2)'}
          on:mouseleave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}>

          <!-- Corner deco -->
          <div class="flex items-start justify-between">
            <p class="text-[12px] font-bold tracking-wider uppercase leading-tight flex-1 pr-2"
              style="color: var(--accent); font-family: var(--font-mono)">{macro.name}</p>
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

          <button on:click={() => dispatch('select', macro)}
            class="w-full py-2.5 text-[10px] font-black tracking-widest uppercase transition-all mt-auto"
            style="background: var(--bg3); color: var(--accent); border: 1px solid var(--accent); font-family: var(--font-mono)"
            on:mouseenter={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'var(--bg)' }}
            on:mouseleave={(e) => { e.currentTarget.style.background = 'var(--bg3)'; e.currentTarget.style.color = 'var(--accent)' }}>
            ▶ RUN
          </button>
        </div>
      {/each}
    </div>
  {/if}
  </div>
</div>