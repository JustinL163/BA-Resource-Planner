import type { Action } from 'svelte/action';
import Sortable from 'sortablejs';
import type { CardMode } from '$lib/domain/planner/card-display';

export interface DragState { source: string; target: string; after: boolean }
interface SortableOptions {
  mode: CardMode;
  change: (state: DragState | null) => void;
  drop: (state: DragState) => void;
  canStart?: (id: string) => boolean;
  canDrop?: (source: string, target: string) => boolean;
}

export const sortable: Action<HTMLElement, SortableOptions> = (node, initial) => {
  let options = initial;
  let pointer: { id: number; source: string; x: number; y: number } | null = null;
  let dragging: DragState | null = null;
  let suppressUntil = 0;
  let frame = 0;
  let pointerY = 0;
  let pointerX = 0;

  function cardAt(x: number, y: number) {
    const card = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-sort-id]');
    return card && node.contains(card) ? card : null;
  }

  function locate() {
    const card = cardAt(pointerX, pointerY);
    if (!card || !pointer || !dragging) return;
    const rect = card.getBoundingClientRect();
    if (options.canDrop && !options.canDrop(pointer.source, card.dataset.sortId!)) {
      dragging = { source: pointer.source, target: '', after: false };
      options.change(dragging);
      return;
    }
    dragging = { source: pointer.source, target: card.dataset.sortId!, after: pointerX > rect.left + rect.width / 2 };
    options.change(dragging);
  }

  function scroll() {
    if (!dragging) return;
    const margin = 60;
    const amount = pointerY < margin ? -12 : pointerY > window.innerHeight - margin ? 12 : 0;
    if (amount) { window.scrollBy(0, amount); locate(); }
    frame = requestAnimationFrame(scroll);
  }

  function down(event: PointerEvent) {
    if (event.button === 0 && event.isPrimary) suppressUntil = 0;
    const card = (event.target instanceof Element ? event.target : null)?.closest<HTMLElement>('[data-sort-id]');
    if (!card || !node.contains(card) || event.button !== 0 || !event.isPrimary ||
      options.mode === 'disable' || options.mode === 'bulk' || event.ctrlKey || event.metaKey) return;
    if (options.canStart && !options.canStart(card.dataset.sortId!)) return;
    if (event.pointerType !== 'mouse' && options.mode !== 'move' && !event.shiftKey) return;
    pointer = { id: event.pointerId, source: card.dataset.sortId!, x: event.clientX, y: event.clientY };
  }

  function move(event: PointerEvent) {
    if (!pointer || event.pointerId !== pointer.id) return;
    if (!dragging && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 8) return;
    if (!dragging) {
      dragging = { source: pointer.source, target: pointer.source, after: false };
      node.setPointerCapture(pointer.id);
      frame = requestAnimationFrame(scroll);
    }
    event.preventDefault();
    pointerX = event.clientX;
    pointerY = event.clientY;
    locate();
  }

  function finish(event: PointerEvent) {
    if (!pointer || pointer.id !== event.pointerId) return;
    const result = dragging;
    if (result) suppressUntil = Date.now() + 350;
    const id = pointer.id;
    pointer = null;
    dragging = null;
    cancelAnimationFrame(frame);
    if (node.hasPointerCapture(id)) node.releasePointerCapture(id);
    options.change(null);
    if (result && event.type === 'pointerup' && cardAt(event.clientX, event.clientY)?.dataset.sortId === result.target &&
      result.source !== result.target) options.drop(result);
  }

  function click(event: MouseEvent) {
    if (Date.now() < suppressUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
  }

  function cancel() {
    if (!pointer) return;
    const id = pointer.id;
    if (dragging) suppressUntil = Date.now() + 350;
    pointer = null;
    dragging = null;
    cancelAnimationFrame(frame);
    if (node.hasPointerCapture(id)) node.releasePointerCapture(id);
    options.change(null);
  }

  function keydown(event: KeyboardEvent) { if (event.key === 'Escape') cancel(); }
  function lostCapture(event: PointerEvent) { if (event.target === node) cancel(); }

  node.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', finish);
  window.addEventListener('pointercancel', finish);
  node.addEventListener('click', click, true);
  node.addEventListener('lostpointercapture', lostCapture);
  window.addEventListener('keydown', keydown);
  window.addEventListener('blur', cancel);
  return {
    update(next) {
      const changedMode = options.mode !== next.mode;
      options = next;
      if (changedMode) cancel();
    },
    destroy() {
      cancelAnimationFrame(frame);
      node.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      node.removeEventListener('click', click, true);
      node.removeEventListener('lostpointercapture', lostCapture);
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('blur', cancel);
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
    if (options.mode === 'disable' || options.mode === 'bulk') return true;
    const input = event as MouseEvent & { pointerType?: string };
    if (input.ctrlKey || input.metaKey) return true;
    const id = target.dataset.sortId ?? '';
    if (options.canStart && !options.canStart(id)) return true;
    const touch = event.type.startsWith('touch') || input.pointerType === 'touch';
    const shift = input.shiftKey ?? false;
    return touch && options.mode !== 'move' && !shift;
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
      forceFallback: false,
      fallbackOnBody: true,
      fallbackTolerance: 8,
      preventOnFilter: false,
      animation: 150,
      scroll: true,
      scrollSensitivity: 60,
      scrollSpeed: 12,
      disabled: options.mode === 'disable' || options.mode === 'bulk',
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
      else instance.option('disabled', next.mode === 'disable' || next.mode === 'bulk');
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
