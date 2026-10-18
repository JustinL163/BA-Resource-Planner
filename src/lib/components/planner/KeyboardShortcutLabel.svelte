<script lang="ts">
  let { label, shortcut, wrap = false }: { label: string; shortcut: string; wrap?: boolean } = $props();

  function formatShortcut(value: string) {
    return value.length === 1 ? value.toUpperCase() : value;
  }
</script>

<span class="shortcut-label" class:wrap>{label}<span class="shortcut-hint" aria-hidden="true">({formatShortcut(shortcut)})</span></span>

<style>
  .shortcut-label { white-space: nowrap; }
  .shortcut-label.wrap { white-space: normal; }
  .shortcut-hint { margin-left: 0.25em; }
  @media (hover: none) and (pointer: coarse) {
    .shortcut-hint { display: none; }
  }
</style>
