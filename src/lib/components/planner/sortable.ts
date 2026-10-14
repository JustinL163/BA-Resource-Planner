import type { Action } from 'svelte/action';
import Sortable, { Swap } from 'sortablejs/modular/sortable.esm.js';
import type { CardMode } from '$lib/domain/planner/card-display';

const sortableWithPlugins = Sortable as typeof Sortable & { teamSwapPluginMounted?: boolean };
if (!sortableWithPlugins.teamSwapPluginMounted) {
  Sortable.mount(new Swap());
  sortableWithPlugins.teamSwapPluginMounted = true;
}

export interface DragState { source: string; target: string; after: boolean }
interface SortableOptions {
  mode: CardMode;
  change: (state: DragState | null) => void;
  drop: (state: DragState) => void;
  canStart?: (id: string) => boolean;
  canDrop?: (source: string, target: string) => boolean;
  handle?: string;
}

type TeamSortableOptions = Omit<SortableOptions, 'mode'> & { mode: CardMode | 'move' | 'disable' };

export const sortable: Action<HTMLElement, TeamSortableOptions> = (node, initial) => {
  let options = initial;
  let instances = new Map<HTMLElement, Sortable>();
  let snapshots = new Map<HTMLElement, Node[]>();
  let dragState: DragState | null = null;
  let dragSource = '';
  let started = false;
  let suppressUntil = 0;

  function restoreOriginalSlots() {
    for (const [list, children] of snapshots) {
      for (let index = children.length - 1; index >= 0; index--) {
        const child = children[index];
        const next = children[index + 1] ?? null;
        if (child.parentNode !== list || child.nextSibling !== next) list.insertBefore(child, next);
      }
    }
    snapshots.clear();
  }

  function finishDrag(event?: Sortable.SortableEvent) {
    const result = dragState;
    const source = event?.item.dataset.sortId ?? dragSource;
    const swappedTarget = event?.swapItem;
    const targetId = swappedTarget?.dataset.sortId ?? '';
    const originalEvent = (event as (Sortable.SortableEvent & { originalEvent?: Event }) | undefined)?.originalEvent;
    const cancelled = originalEvent?.type === 'pointercancel' || originalEvent?.type === 'touchcancel';
    const dropResult = started && !cancelled && result && swappedTarget && swappedTarget !== event?.item &&
      result.source === source && targetId && targetId !== source &&
      (!options.canDrop || options.canDrop(source, targetId)) ? { ...result, target: targetId } : null;

    if (started) suppressUntil = Date.now() + 300;
    started = false;
    dragState = null;
    dragSource = '';
    restoreOriginalSlots();
    options.change(null);
    if (dropResult) options.drop(dropResult);
  }

  function createList(list: HTMLElement) {
    return Sortable.create(list, {
      draggable: '[data-sort-id]',
      group: { name: 'team-slots', pull: true, put: true },
      swap: true,
      swapClass: 'sortable-swap-highlight',
      forceFallback: true,
      fallbackOnBody: true,
      fallbackClass: 'team-sortable-fallback',
      fallbackTolerance: 8,
      preventOnFilter: false,
      // Svelte owns slot order; avoid animating Sortable's temporary DOM swap before restoration.
      animation: 0,
      delay: 100,
      delayOnTouchOnly: true,
      scroll: true,
      scrollSensitivity: 60,
      scrollSpeed: 12,
      disabled: options.mode === 'disable' || options.mode === 'bulk',
      filter(event, target) {
        const input = event as MouseEvent & { pointerType?: string };
        const id = target.dataset.sortId ?? '';
        return options.mode === 'disable' || options.mode === 'bulk' || input.ctrlKey || input.metaKey ||
          Boolean(options.canStart && !options.canStart(id));
      },
      onStart(event) {
        dragSource = event.item.dataset.sortId ?? '';
        if (!dragSource) return;
        snapshots = new Map([...node.querySelectorAll<HTMLElement>('.slots')]
          .map((slotList) => [slotList, [...slotList.childNodes]]));
        started = true;
        dragState = { source: dragSource, target: dragSource, after: false };
        options.change(dragState);
      },
      onMove(event) {
        const source = event.dragged.dataset.sortId ?? dragSource;
        const target = event.related.dataset.sortId ?? '';
        if (!source || !target || (options.canDrop && !options.canDrop(source, target))) {
          dragState = { source, target: '', after: false };
          options.change(dragState);
          return false;
        }
        dragState = { source, target, after: event.willInsertAfter ?? false };
        options.change(dragState);
      },
      onEnd(event) { finishDrag(event); }
    });
  }

  function syncLists() {
    const lists = new Set(node.querySelectorAll<HTMLElement>('.slots'));
    for (const [list, instance] of instances) {
      if (!lists.has(list)) { instance.destroy(); instances.delete(list); }
    }
    for (const list of lists) {
      if (!instances.has(list)) instances.set(list, createList(list));
      else instances.get(list)!.option('disabled', options.mode === 'disable' || options.mode === 'bulk');
    }
  }

  function cancelDrag() {
    if (!started) return;
    suppressUntil = Date.now() + 300;
    started = false;
    dragState = null;
    dragSource = '';
    for (const instance of instances.values()) instance.destroy();
    instances.clear();
    restoreOriginalSlots();
    options.change(null);
    syncLists();
  }

  function click(event: MouseEvent) {
    if (Date.now() < suppressUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
  }
  function keydown(event: KeyboardEvent) { if (event.key === 'Escape') cancelDrag(); }

  syncLists();
  const observer = new MutationObserver(syncLists);
  observer.observe(node, { childList: true, subtree: true });
  node.addEventListener('click', click, true);
  window.addEventListener('keydown', keydown);
  window.addEventListener('blur', cancelDrag);
  return {
    update(next) {
      const changedMode = options.mode !== next.mode;
      options = next;
      if (changedMode && started) cancelDrag();
      syncLists();
    },
    destroy() {
      observer.disconnect();
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('blur', cancelDrag);
      node.removeEventListener('click', click, true);
      const wasStarted = started;
      started = false;
      dragState = null;
      dragSource = '';
      for (const instance of instances.values()) instance.destroy();
      instances.clear();
      if (wasStarted) {
        restoreOriginalSlots();
        options.change(null);
      }
    }
  };
};

interface TeamOrderOptions {
  change: (source: number | null) => void;
  drop: (source: number, target: number) => void;
}

export const sortableTeams: Action<HTMLElement, TeamOrderOptions> = (node, initial) => {
  let options = initial;
  let originalChildren: Node[] = [];
  let originalTeams: HTMLElement[] = [];
  let started = false;
  let suppressUntil = 0;

  function restoreOriginalOrder() {
    for (let index = originalChildren.length - 1; index >= 0; index--) {
      const child = originalChildren[index];
      const next = originalChildren[index + 1] ?? null;
      if (child.parentNode !== node || child.nextSibling !== next) node.insertBefore(child, next);
    }
    originalChildren = [];
    originalTeams = [];
  }

  function createInstance() {
    return Sortable.create(node, {
      draggable: '.team',
      handle: '.team-drag-handle',
      forceFallback: true,
      fallbackOnBody: true,
      fallbackClass: 'team-order-fallback',
      fallbackTolerance: 8,
      preventOnFilter: false,
      // Restore the original DOM order before the state update, so avoid animating the temporary order.
      animation: 0,
      delay: 100,
      delayOnTouchOnly: true,
      scroll: true,
      scrollSensitivity: 60,
      scrollSpeed: 12,
      onMove(event, originalEvent) {
        // The outer sorter treats each whole team as one item. Resolve nested
        // slot targets back to their containing team so they can be drop areas
        // without becoming individual team-sort items.
        const pointer = originalEvent as MouseEvent & { touches?: TouchList; changedTouches?: TouchList };
        const touch = pointer.changedTouches?.[0] ?? pointer.touches?.[0];
        const x = touch?.clientX ?? pointer.clientX;
        const y = touch?.clientY ?? pointer.clientY;
        const target = Number.isFinite(x) && Number.isFinite(y)
          ? document.elementFromPoint(x, y)
          : originalEvent.target instanceof Element ? originalEvent.target : null;
        const team = target?.closest('.team');
        return team === event.related ? undefined : false;
      },
      onStart(event) {
        // The visible fallback ghost is appended to <body>, so it no longer
        // inherits --card-size from the capture container that sizes its slots.
        const cardSize = getComputedStyle(event.item).getPropertyValue('--card-size').trim();
        if (cardSize) Sortable.ghost?.style.setProperty('--card-size', cardSize);
        originalChildren = [...node.childNodes];
        originalTeams = [...node.children] as HTMLElement[];
        const source = originalTeams.indexOf(event.item);
        started = source >= 0;
        if (started) options.change(source);
      },
      onEnd(event) {
        const source = originalTeams.indexOf(event.item);
        const target = [...node.children].indexOf(event.item);
        const originalEvent = (event as (Sortable.SortableEvent & { originalEvent?: Event })).originalEvent;
        const cancelled = originalEvent?.type === 'pointercancel' || originalEvent?.type === 'touchcancel';
        if (started) suppressUntil = Date.now() + 300;
        started = false;
        restoreOriginalOrder();
        options.change(null);
        if (!cancelled && source >= 0 && target >= 0 && source !== target) options.drop(source, target);
      }
    });
  }
  let instance = createInstance();

  function cancelDrag() {
    if (!started) return;
    started = false;
    suppressUntil = Date.now() + 300;
    instance.destroy();
    restoreOriginalOrder();
    options.change(null);
    instance = createInstance();
  }

  function click(event: MouseEvent) {
    if (Date.now() < suppressUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
  }
  function keydown(event: KeyboardEvent) { if (event.key === 'Escape') cancelDrag(); }

  node.addEventListener('click', click, true);
  window.addEventListener('keydown', keydown);
  window.addEventListener('blur', cancelDrag);
  return {
    update(next) { options = next; },
    destroy() {
      const wasStarted = started;
      started = false;
      instance.destroy();
      node.removeEventListener('click', click, true);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('blur', cancelDrag);
      if (wasStarted) {
        restoreOriginalOrder();
        options.change(null);
      }
    }
  };
};

export const sortableReorder: Action<HTMLElement, SortableOptions> = (node, initial) => {
  const clickSuppressionMs = 300;
  let options = initial;
  let originalChildren: Node[] = [];
  let originalIds: string[] = [];
  let dragSource = '';
  let started = false;
  let suppressUntil = 0;

  function ids() {
    return Array.from(node.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement && child.hasAttribute('data-sort-id'))
      .map((child) => child.dataset.sortId ?? '');
  }

  function filtered(event: Event | TouchEvent, target: HTMLElement) {
    if (options.mode === 'bulk') return true;
    const input = event as MouseEvent & { pointerType?: string };
    if (input.ctrlKey || input.metaKey) return true;
    const id = target.dataset.sortId ?? '';
    if (options.canStart && !options.canStart(id)) return true;
    return false;
  }

  function restoreOriginalOrder() {
    for (let index = originalChildren.length - 1; index >= 0; index--) {
      const child = originalChildren[index];
      const next = originalChildren[index + 1] ?? null;
      if (child.nextSibling !== next) node.insertBefore(child, next);
    }
  }

  function clearDragState() {
    restoreOriginalOrder();
    originalChildren = [];
    originalIds = [];
    dragSource = '';
    started = false;
    options.change(null);
  }

  function createSortable() {
    return Sortable.create(node, {
      draggable: '[data-sort-id]',
      handle: options.handle,
      forceFallback: false,
      fallbackOnBody: true,
      fallbackTolerance: 8,
      preventOnFilter: false,
      animation: 150,
      delay: 100,
      delayOnTouchOnly: true,
      scroll: true,
      scrollSensitivity: 60,
      scrollSpeed: 12,
      disabled: options.mode === 'bulk',
      filter: filtered,
      onStart(event) {
        dragSource = event.item.dataset.sortId ?? '';
        // Keep Svelte's keyed children in their source order until the data update commits the move.
        originalChildren = Array.from(node.childNodes);
        originalIds = ids();
        started = Boolean(dragSource);
        if (started) options.change({ source: dragSource, target: dragSource, after: false });
      },
      onMove(event) {
        const source = event.dragged.dataset.sortId ?? dragSource;
        const target = event.related.dataset.sortId ?? '';
        if (!source || !target || (options.canDrop && !options.canDrop(source, target))) return false;
      },
      onEnd(event) {
        const source = event.item.dataset.sortId ?? dragSource;
        const originalEvent = (event as Event & { originalEvent?: Event }).originalEvent;
        const cancelled = originalEvent?.type === 'pointercancel' || originalEvent?.type === 'touchcancel';
        const newIds = ids();
        const oldIndex = originalIds.indexOf(source);
        const newIndex = newIds.indexOf(source);
        let result: DragState | null = null;
        if (!cancelled && oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          const after = newIndex > oldIndex;
          const target = newIds[newIndex + (after ? -1 : 1)];
          if (target && target !== source && (!options.canDrop || options.canDrop(source, target))) {
            result = { source, target, after };
          }
        }

        if (started) suppressUntil = Date.now() + clickSuppressionMs;
        clearDragState();
        if (result) options.drop(result);
      }
    });
  }

  let instance = createSortable();

  function cancelDrag() {
    if (!started) return;
    suppressUntil = Date.now() + clickSuppressionMs;
    instance.destroy();
    clearDragState();
    instance = createSortable();
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') cancelDrag();
  }

  function click(event: MouseEvent) {
    if (Date.now() < suppressUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  node.addEventListener('click', click, true);
  window.addEventListener('keydown', keydown);
  window.addEventListener('blur', cancelDrag);
  return {
    update(next) {
      const changedMode = options.mode !== next.mode;
      options = next;
      if (changedMode && started) cancelDrag();
      else instance.option('disabled', next.mode === 'bulk');
    },
    destroy() {
      const wasDragging = started;
      instance.destroy();
      node.removeEventListener('click', click, true);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('blur', cancelDrag);
      if (wasDragging) clearDragState();
    }
  };
};
