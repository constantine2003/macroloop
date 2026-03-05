<script>
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()
  export let macros = []

  let editingId = null
  let editingName = ''

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  function fmtDur(ms) { return !ms ? '0s' : ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s` }

  function getMacroColor(macro) {
    if (!macro.events) return null
    const click = macro.events.find(e => (e.type === 'mousedown' || e.type === 'click') && e.color)
    return click ? click.color.hex : null
  }

  function startRename(macro) {
    editingId = macro.id
    editingName = macro.name
    // Focus input on next tick
    setTimeout(() => {
      const el = document.getElementById(`rename-${macro.id}`)
      if (el) { el.focus(); el.select() }
    }, 30)
  }

  function commitRename(macro) {
    if (!editingName.trim() || editingName.trim() === macro.name) {
      cancelRename()
      return
    }
    dispatch('rename', { id: macro.id, name: editingName.trim() })
    editingId = null
    editingName = ''
  }

  function cancelRename() {
    editingId = null
    editingName = ''
  }

  function onKeydown(e, macro) {
    if (e.key === 'Enter') commitRename(macro)
    if (e.key === 'Escape') cancelRename()
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

          <!-- Name row -->
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-2 flex-1 pr-2 min-w-0">
              <!-- Color dot -->
              {#if getMacroColor(macro)}
                <div class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style="background: {getMacroColor(macro)}; box-shadow: 0 0 6px {getMacroColor(macro)}; border: 1px solid {getMacroColor(macro)}88"
                  title="Color tracking: {getMacroColor(macro)}"></div>
              {:else}
                <div class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style="background: var(--border2); border: 1px solid var(--border)"
                  title="No color data"></div>
              {/if}

              <!-- Name / rename input -->
              {#if editingId === macro.id}
                <input
                  id="rename-{macro.id}"
                  bind:value={editingName}
                  on:keydown={(e) => onKeydown(e, macro)}
                  on:blur={() => commitRename(macro)}
                  class="flex-1 min-w-0 bg-transparent text-[12px] font-bold tracking-wider uppercase outline-none"
                  style="color: var(--accent); font-family: var(--font-mono); border-bottom: 1px solid var(--accent)"/>
              {:else}
                <button
                  on:click={() => startRename(macro)}
                  class="flex-1 min-w-0 text-left text-[12px] font-bold tracking-wider uppercase truncate transition-all"
                  style="color: var(--accent); font-family: var(--font-mono); background: transparent; border: none; padding: 0"
                  title="Click to rename">
                  {macro.name}
                </button>
              {/if}
            </div>

            <!-- Rename confirm / cancel or delete -->
            {#if editingId === macro.id}
              <div class="flex gap-1 flex-shrink-0">
                <button on:click={() => commitRename(macro)}
                  class="w-6 h-6 flex items-center justify-center text-[10px] font-bold"
                  style="color: var(--accent); border: 1px solid var(--accent); font-family: var(--font-mono)"
                  title="Confirm rename">✓</button>
                <button on:click={cancelRename}
                  class="w-6 h-6 flex items-center justify-center text-[10px] font-bold"
                  style="color: var(--muted); border: 1px solid var(--border); font-family: var(--font-mono)"
                  title="Cancel">✕</button>
              </div>
            {:else}
              <button on:click={() => dispatch('delete', { id: macro.id })}
                class="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-[10px] font-bold transition-all flex-shrink-0"
                style="color: var(--muted); border: 1px solid var(--border); font-family: var(--font-mono)"
                on:mouseenter={(e) => { e.currentTarget.style.color = 'var(--accent2)'; e.currentTarget.style.borderColor = 'var(--accent2)' }}
                on:mouseleave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                ✕
              </button>
            {/if}
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