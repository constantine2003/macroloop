<script>
  function minimize() { window.electron?.minimize() }
  function maximize() { window.electron?.maximize() }
  function close() { window.electron?.close() }
</script>

<div class="titlebar">
  <div class="drag-region"></div>
  <div class="controls">
    <button class="ctrl minimize" on:click={minimize} title="Minimize">
      <svg viewBox="0 0 12 12"><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" stroke-width="1.5"/></svg>
    </button>
    <button class="ctrl maximize" on:click={maximize} title="Maximize">
      <svg viewBox="0 0 12 12"><rect x="2" y="2" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
    </button>
    <button class="ctrl close" on:click={close} title="Close">
      <svg viewBox="0 0 12 12"><line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" stroke-width="1.5"/><line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" stroke-width="1.5"/></svg>
    </button>
  </div>
</div>

<style>
  .titlebar {
    height: 36px;
    background: #0a0a0f;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .drag-region {
    flex: 1;
    height: 100%;
    -webkit-app-region: drag;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 2px;
    padding-right: 8px;
  }

  .ctrl {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    transition: all 0.15s;
  }

  .ctrl svg {
    width: 12px;
    height: 12px;
  }

  .ctrl:hover { background: var(--bg3); color: var(--text); }
  .ctrl.close:hover { background: var(--accent); color: white; }
</style>
