<script>
  import { onMount } from 'svelte'
  import Recorder from './components/Recorder.svelte'
  import Player from './components/Player.svelte'
  import MacroList from './components/MacroList.svelte'

  let page = 'home'
  let macros = []
  let selectedMacro = null
  let theme = 'cyber'
  let showThemePicker = false

  const themes = [
    { id: 'cyber',    label: 'CYBER',    desc: 'Neon dark',     dot: '#00ffcc' },
    { id: 'bubble',   label: 'BUBBLE',   desc: 'Y2K pink',      dot: '#ff3399' },
    { id: 'terminal', label: 'TERMINAL', desc: 'Green CRT',     dot: '#00ff41' },
    { id: 'vapor',    label: 'VAPOR',    desc: 'Synthwave',     dot: '#ff6600' },
    { id: 'clean',    label: 'CLEAN',    desc: 'Light minimal', dot: '#3355ff' },
  ]

  onMount(async () => {
    theme = localStorage.getItem('ml-theme') || 'cyber'
    applyTheme()
    await loadMacros()
    window.electron?.onHotkey((key) => {
      if (key === 'toggle-record') page = 'record'
      if (key === 'toggle-play') page = 'play'
    })
  })

  function applyTheme() {
    document.body.className = `theme-${theme}`
    localStorage.setItem('ml-theme', theme)
  }

  function setTheme(t) {
    theme = t
    applyTheme()
    showThemePicker = false
  }

  async function loadMacros() {
    if (window.electron) macros = await window.electron.loadMacros()
  }

  async function handleSaveMacro(e) {
    const { name, events, duration } = e.detail
    const macro = {
      id: Date.now().toString(), name, events, duration,
      eventCount: events.length,
      clickCount: events.filter(ev => ev.type === 'mousedown').length,
      keyCount: events.filter(ev => ev.type === 'keydown').length,
      createdAt: new Date().toISOString()
    }
    if (window.electron) await window.electron.saveMacro(macro)
    await loadMacros()
    page = 'macros'
  }

  async function handleDeleteMacro(e) {
    if (window.electron) await window.electron.deleteMacro(e.detail.id)
    if (selectedMacro?.id === e.detail.id) selectedMacro = null
    await loadMacros()
  }

  function handleSelectMacro(e) {
    selectedMacro = e.detail
    page = 'play'
  }
</script>

<!-- Window chrome -->
<div class="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-3 h-8"
  style="background: var(--bg2); border-bottom: 1px solid var(--border); -webkit-app-region: drag">
  <div class="flex items-center gap-2" style="-webkit-app-region: no-drag">
    <div class="w-4 h-4 rounded-sm flex items-center justify-center" style="background: var(--accent)">
      <span class="block w-1.5 h-1.5 rounded-full" style="background: var(--bg)"></span>
    </div>
    <span class="text-[11px] font-bold tracking-widest uppercase" style="color: var(--accent); font-family: var(--font-mono)">MacroLoop v1.0</span>
  </div>
  <div class="flex items-center gap-1" style="-webkit-app-region: no-drag">
    <!-- Theme picker trigger -->
    <button on:click={() => showThemePicker = !showThemePicker}
      class="h-5 px-2 text-[9px] font-bold tracking-widest uppercase transition-all"
      style="color: var(--muted); font-family: var(--font-mono); border: 1px solid var(--border); border-radius: 2px;">
      {themes.find(t => t.id === theme)?.label}
    </button>
    <button on:click={() => window.electron?.minimize()}
      class="w-5 h-5 flex items-center justify-center text-[10px] transition-opacity hover:opacity-60"
      style="color: var(--muted); font-family: var(--font-mono)">─</button>
    <button on:click={() => window.electron?.maximize()}
      class="w-5 h-5 flex items-center justify-center text-[10px] transition-opacity hover:opacity-60"
      style="color: var(--muted); font-family: var(--font-mono)">□</button>
    <button on:click={() => window.electron?.close()}
      class="w-5 h-5 flex items-center justify-center text-[10px] transition-opacity hover:opacity-60"
      style="color: var(--accent2); font-family: var(--font-mono)">✕</button>
  </div>
</div>

<!-- Theme picker dropdown -->
{#if showThemePicker}
  <div class="fixed top-8 right-3 z-50 p-2 flex flex-col gap-1 animate-scanin"
    style="background: var(--bg2); border: 1px solid var(--border2); width: 180px; box-shadow: var(--glow2)">
    <p class="text-[9px] font-bold tracking-widest px-2 py-1" style="color: var(--muted); font-family: var(--font-mono)">SELECT THEME</p>
    {#each themes as t}
      <button on:click={() => setTheme(t.id)}
        class="flex items-center gap-3 px-3 py-2 text-left transition-all"
        style="background: {theme === t.id ? 'var(--bg3)' : 'transparent'}; border: 1px solid {theme === t.id ? 'var(--border2)' : 'transparent'}">
        <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background: {t.dot}; box-shadow: 0 0 6px {t.dot}"></span>
        <div>
          <p class="text-[11px] font-bold" style="color: {theme === t.id ? 'var(--accent)' : 'var(--text)'}; font-family: var(--font-mono)">{t.label}</p>
          <p class="text-[9px]" style="color: var(--muted); font-family: var(--font-mono)">{t.desc}</p>
        </div>
        {#if theme === t.id}
          <span class="ml-auto text-[10px]" style="color: var(--accent)">◆</span>
        {/if}
      </button>
    {/each}
  </div>
  <!-- Close overlay -->
  <div class="fixed inset-0 z-40" on:click={() => showThemePicker = false}></div>
{/if}

<!-- Pages -->
<div class="h-screen pt-8 overflow-hidden" style="background: var(--bg)">

  {#if page === 'home'}
    <!-- HOME SCREEN -->
    <div class="h-full flex flex-col items-center justify-center gap-8 px-8 animate-scanin">

      <!-- Big logo -->
      <div class="text-center">
        <div class="text-[64px] font-black tracking-tighter leading-none mb-2"
          style="color: var(--accent); font-family: var(--font-display); text-shadow: var(--glow); letter-spacing: -2px">
          MACRO<span style="color: var(--accent2)">LOOP</span>
        </div>
        <div class="text-[11px] tracking-[6px] uppercase" style="color: var(--muted); font-family: var(--font-mono)">
          Game Automation System v1.0
        </div>
      </div>

      <!-- 3 big nav cards -->
      <div class="grid grid-cols-3 gap-4 w-full max-w-2xl">
        {#each [
          { id: 'record', label: 'RECORD', sub: 'Capture inputs', icon: '⬤', key: 'F6' },
          { id: 'play',   label: 'PLAY',   sub: 'Run macros',    icon: '▶', key: 'F7' },
          { id: 'macros', label: 'MACROS', sub: macros.length + ' saved', icon: '▦', key: null },
        ] as card}
          <button on:click={() => page = card.id}
            class="group flex flex-col items-center gap-4 py-8 px-4 transition-all relative overflow-hidden"
            style="background: var(--bg2); border: 1px solid var(--border); cursor: pointer"
            on:mouseenter={(e) => e.currentTarget.style.borderColor = 'var(--border2)'}
            on:mouseleave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <!-- Corner decorations -->
            <span class="absolute top-1 left-1 text-[8px]" style="color: var(--border2)">◤</span>
            <span class="absolute top-1 right-1 text-[8px]" style="color: var(--border2)">◥</span>
            <span class="absolute bottom-1 left-1 text-[8px]" style="color: var(--border2)">◣</span>
            <span class="absolute bottom-1 right-1 text-[8px]" style="color: var(--border2)">◢</span>

            <span class="text-4xl animate-float" style="color: var(--accent)">{card.icon}</span>
            <div class="text-center">
              <p class="text-lg font-black tracking-widest" style="color: var(--text); font-family: var(--font-display)">{card.label}</p>
              <p class="text-[10px] mt-1" style="color: var(--muted); font-family: var(--font-mono)">{card.sub}</p>
            </div>
            {#if card.key}
              <span class="text-[9px] px-2 py-0.5" style="color: var(--accent3); font-family: var(--font-mono); border: 1px solid var(--accent3)">{card.key}</span>
            {/if}
          </button>
        {/each}
      </div>

      <!-- Status bar -->
      <div class="flex items-center gap-6 text-[10px]" style="color: var(--muted); font-family: var(--font-mono)">
        <span>■ {macros.length} MACROS SAVED</span>
        <span>■ PRESS F6 TO RECORD</span>
        <span>■ PRESS F7 TO PLAY</span>
      </div>
    </div>

  {:else if page === 'record'}
    <Recorder on:save={handleSaveMacro} on:back={() => page = 'home'} />

  {:else if page === 'play'}
    <Player macro={selectedMacro} {macros} on:select={handleSelectMacro} on:back={() => page = 'home'} />

  {:else if page === 'macros'}
    <MacroList {macros} on:select={handleSelectMacro} on:delete={handleDeleteMacro} on:back={() => page = 'home'} />
  {/if}

</div>