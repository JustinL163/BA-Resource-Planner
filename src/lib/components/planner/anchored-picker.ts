import type { Action } from 'svelte/action';

export interface PickerViewport { left: number; top: number; right: number; bottom: number }
interface PickerOptions {
  anchor: HTMLElement;
  slots: HTMLElement;
  dismiss: (restoreFocus: boolean) => void;
}

export function pickerPosition(
  anchor: Pick<DOMRectReadOnly, 'left' | 'top' | 'bottom'>,
  size: { width: number; height: number }, viewport: PickerViewport
): { left: number; top: number } {
  const gap = 6;
  const left = Math.max(viewport.left + gap, Math.min(anchor.left, viewport.right - size.width - gap));
  const above = anchor.top - size.height - gap;
  const below = anchor.bottom + gap;
  const preferred = above >= viewport.top + gap ? above :
    below + size.height <= viewport.bottom - gap ? below : above;
  const top = Math.max(viewport.top + gap, Math.min(preferred, viewport.bottom - size.height - gap));
  return { left, top };
}

export const anchoredPicker: Action<HTMLDialogElement, PickerOptions> = (panel, initial) => {
  let options = initial;
  let frame = 0;
  const viewport = () => {
    const visual = window.visualViewport;
    const top = visual?.offsetTop ?? 0;
    const bottom = top + (visual?.height ?? window.innerHeight);
    const headerBottom = document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? top;
    const toolsTop = document.querySelector('.planner-actions')?.getBoundingClientRect().top ?? bottom;
    return {
      left: visual?.offsetLeft ?? 0,
      right: (visual?.offsetLeft ?? 0) + (visual?.width ?? window.innerWidth),
      top: Math.max(top, Math.min(headerBottom, bottom - 40)),
      bottom: Math.max(top + 40, Math.min(toolsTop, bottom))
    };
  };
  function position() {
    if (!options.anchor.isConnected) { options.dismiss(false); return; }
    const bounds = viewport();
    panel.style.maxWidth = `${Math.max(0, bounds.right - bounds.left - 12)}px`;
    panel.style.maxHeight = `${Math.max(0, bounds.bottom - bounds.top - 12)}px`;
    const size = panel.getBoundingClientRect();
    const point = pickerPosition(options.anchor.getBoundingClientRect(), size, bounds);
    panel.style.left = `${point.left}px`;
    panel.style.top = `${point.top}px`;
    panel.style.visibility = 'visible';
  }
  function reveal() {
    const rect = options.anchor.getBoundingClientRect();
    const bounds = viewport();
    if (rect.top - panel.offsetHeight - 6 < bounds.top || rect.bottom > bounds.bottom - 6) {
      const height = panel.offsetHeight;
      const remaining = bounds.bottom - bounds.top - height - rect.height - 12;
      const top = bounds.top + height + 6 + Math.max(0, remaining / 2);
      window.scrollBy({ top: rect.top - top });
    }
    position();
  }
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(position);
  }
  function resize() { reveal(); schedule(); }
  function outside(event: Event) {
    if (!(event.target instanceof Node) || panel.contains(event.target)) return;
    const slot = event.target instanceof Element ? event.target.closest('[data-sort-id]') : null;
    if (slot && options.slots.contains(slot)) return;
    options.dismiss(false);
  }
  function focusOutside(event: FocusEvent) { if (event.target !== document.body) outside(event); }
  const observer = new ResizeObserver(schedule);
  observer.observe(panel);
  observer.observe(options.anchor);
  document.addEventListener('pointerdown', outside, true);
  document.addEventListener('focusin', focusOutside);
  window.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('scroll', schedule);
  window.visualViewport?.addEventListener('resize', resize);
  reveal();
  return {
    update(next) {
      const changed = options.anchor !== next.anchor;
      if (changed) observer.unobserve(options.anchor);
      options = next;
      if (changed) { observer.observe(options.anchor); reveal(); }
      else schedule();
    },
    destroy() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('focusin', focusOutside);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', schedule);
      window.visualViewport?.removeEventListener('resize', resize);
    }
  };
};
