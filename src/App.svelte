<script>
  import { onMount } from 'svelte'
  import Recorder from './components/Recorder.svelte'
  import Player from './components/Player.svelte'
  import MacroList from './components/MacroList.svelte'

  let activeTab = 'record'
  let macros = []
  let selectedMacro = null
  let dark = true

  onMount(async () => {
    const saved = localStorage.getItem('theme')
    dark = saved ? saved === 'dark' : true
    applyTheme()
    await loadMacros()

    window.electron?.onHotkey((key) => {
      if (key === 'toggle-record') activeTab = 'record'
      if (key === 'toggle-play' && selectedMacro) activeTab = 'play'
    })
  })

  function applyTheme() {
    if (dark) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }

  function toggleTheme() {
    dark = !dark
    applyTheme()
  }

  async function loadMacros() {
    if (window.electron) macros = await window.electron.loadMacros()
  }

  async function handleSaveMacro(e) {
    const { name, events, duration } = e.detail
    const macro = {
      id: Date.now().toString(),
      name,
      events,
      duration,
      eventCount: events.length,
      clickCount: events.filter(ev => ev.type === 'mousedown').length,
      keyCount: events.filter(ev => ev.type === 'keydown').length,
      createdAt: new Date().toISOString()
    }
    if (window.electron) await window.electron.saveMacro(macro)
    await loadMacros()
    activeTab = 'macros'
  }

  async function handleDeleteMacro(e) {
    if (window.electron) await window.electron.deleteMacro(e.detail.id)
    if (selectedMacro?.id === e.detail.id) selectedMacro = null
    await loadMacros()
  }

  function handleSelectMacro(e) {
    selectedMacro = e.detail
    activeTab = 'play'
  }

  const tabs = [
    { id: 'record', label: 'Record', icon: `<circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>` },
    { id: 'play',   label: 'Play',   icon: `<polygon points="6,4 20,12 6,20" fill="currentColor"/>` },
    { id: 'macros', label: 'Macros', icon: `<rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/>` },
  ]
</script>

<div class="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 select-none overflow-hidden">

  <!-- Title bar + Nav combined -->
  <header class="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">

    <!-- Drag region + window controls -->
    <div class="flex items-center justify-between px-4 pt-2" style="-webkit-app-region: drag">
      <!-- Logo -->
      <div class="flex items-center gap-2.5">
        <div class="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <span class="w-2.5 h-2.5 rounded-full bg-white block animate-pulse-slow"></span>
        </div>
        <span class="font-bold text-sm tracking-tight text-gray-900 dark:text-white">MacroLoop</span>
      </div>

      <!-- Window controls -->
      <div class="flex items-center gap-1" style="-webkit-app-region: no-drag">
        <button on:click={toggleTheme}
          class="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          {#if dark}
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          {:else}
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          {/if}
        </button>
        <button on:click={() => window.electron?.minimize()}
          class="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <svg class="w-3 h-3" viewBox="0 0 12 12"><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
        <button on:click={() => window.electron?.maximize()}
          class="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <svg class="w-3 h-3" viewBox="0 0 12 12"><rect x="2" y="2" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
        </button>
        <button on:click={() => window.electron?.close()}
          class="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
          <svg class="w-3 h-3" viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.5"/></svg>
        </button>
      </div>
    </div>

    <!-- Tab nav -->
    <nav class="flex items-center gap-1 px-4 pb-0 mt-1">
      {#each tabs as tab}
        <button
          on:click={() => activeTab = tab.id}
          class="relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg
            {activeTab === tab.id
              ? 'text-indigo-600 dark:text-indigo-400'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24">{@html tab.icon}</svg>
          {tab.label}
          {#if tab.id === 'macros' && macros.length > 0}
            <span class="ml-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400">
              {macros.length}
            </span>
          {/if}
          {#if activeTab === tab.id}
            <span class="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></span>
          {/if}
        </button>
      {/each}
    </nav>
  </header>

  <!-- Page content -->
  <main class="flex-1 overflow-hidden">
    {#if activeTab === 'record'}
      <Recorder on:save={handleSaveMacro} />
    {:else if activeTab === 'play'}
      <Player macro={selectedMacro} {macros} on:select={handleSelectMacro} />
    {:else if activeTab === 'macros'}
      <MacroList {macros} on:select={handleSelectMacro} on:delete={handleDeleteMacro} />
    {/if}
  </main>
</div>
