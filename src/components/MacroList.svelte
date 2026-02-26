<script>
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()

  export let macros = []

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  function fmtDur(ms) {
    if (!ms) return '0s'
    return ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s`
  }
</script>

<div class="h-full flex flex-col overflow-y-auto p-6 gap-5 bg-gray-50 dark:bg-gray-950 animate-fade-in">

  <div class="flex items-start justify-between">
    <div>
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">Saved Macros</h1>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{macros.length} macro{macros.length !== 1 ? 's' : ''} saved locally</p>
    </div>
  </div>

  {#if macros.length === 0}
    <div class="flex-1 flex flex-col items-center justify-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-12 gap-3 text-center">
      <div class="text-5xl mb-2">🎮</div>
      <p class="font-semibold text-gray-800 dark:text-gray-200">No macros yet</p>
      <p class="text-sm text-gray-400">Record your first macro to see it here</p>
    </div>

  {:else}
    <div class="grid grid-cols-2 gap-3">
      {#each macros as macro}
        <div class="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-2xl p-4 flex flex-col gap-3 transition-all hover:shadow-md hover:shadow-indigo-500/5">

          <!-- Top -->
          <div class="flex items-start justify-between gap-2">
            <p class="font-bold text-sm text-gray-900 dark:text-white leading-tight">{macro.name}</p>
            <button on:click={() => dispatch('delete', { id: macro.id })}
              class="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex-shrink-0">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/><path d="M19,6L18,20a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
                <path d="M10,11v6M14,11v6"/>
              </svg>
            </button>
          </div>

          <!-- Stats chips -->
          <div class="flex gap-1.5 flex-wrap">
            <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
              {macro.eventCount} events
            </span>
            {#if macro.clickCount}
              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                {macro.clickCount} clicks
              </span>
            {/if}
            {#if macro.keyCount}
              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                {macro.keyCount} keys
              </span>
            {/if}
            <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
              {fmtDur(macro.duration)}
            </span>
          </div>

          <p class="text-[10px] font-mono text-gray-400">{fmtDate(macro.createdAt)}</p>

          <button on:click={() => dispatch('select', macro)}
            class="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center justify-center gap-1.5 shadow-sm mt-auto">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
            Run Macro
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>
