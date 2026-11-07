import type { Action } from 'svelte/action';

export type FitResourceTextLayout = 'inline-amount' | 'cell-amount' | 'name';
export type FitResourceTextArgument = { text: string; layout: FitResourceTextLayout };

export const fitResourceText: Action<HTMLElement, FitResourceTextArgument | undefined> = (node, initialValue) => {
  if (initialValue === undefined) return {};

  let value: string | undefined = initialValue.text;
  let layout = initialValue.layout;
  let frame = 0;
  let observer: ResizeObserver | undefined;
  const container = node.parentElement;
  const baseFontSize = Number.parseFloat(getComputedStyle(node).fontSize) || 24;
  const range = document.createRange();

  function fit() {
    if (value === undefined || !container) return;
    const siblings = [...container.children].filter((child) => {
      if (child === node || layout !== 'inline-amount') return false;
      const position = getComputedStyle(child).position;
      return position !== 'absolute' && position !== 'fixed';
    });
    const style = getComputedStyle(container);
    const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
    const gap = Number.parseFloat(style.columnGap) || Number.parseFloat(style.gap) || 0;
    const occupied = siblings.reduce((sum, child) => sum + child.getBoundingClientRect().width, 0) + gap * siblings.length;
    const configuredRatio = Number.parseFloat(style.getPropertyValue('--overlay-number-fit-ratio'));
    const fitRatio = layout === 'name' || !Number.isFinite(configuredRatio)
      ? 1
      : Math.min(1, Math.max(0, configuredRatio));
    const availableWidth = Math.max(0, ((layout === 'name' ? node.clientWidth : container.clientWidth) - padding - occupied - 2) * fitRatio);
    const availableHeight = layout === 'name' ? Math.max(0, container.clientHeight * 0.4) : Number.POSITIVE_INFINITY;
    node.style.removeProperty('font-size');
    range.selectNodeContents(node);
    const fits = () => {
      const bounds = range.getBoundingClientRect();
      return bounds.width <= availableWidth && bounds.height <= availableHeight;
    };
    if (fits()) return;

    let low = 0;
    let high = baseFontSize;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const size = (low + high) / 2;
      node.style.fontSize = `${size}px`;
      if (fits()) low = size;
      else high = size;
    }
    node.style.fontSize = `${low}px`;
  }

  function scheduleFit() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(fit);
  }

  function observe() {
    if (value !== undefined && container && !observer && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(scheduleFit);
      observer.observe(container);
    }
    scheduleFit();
  }

  observe();
  return {
    update(nextValue) {
      value = nextValue?.text;
      if (nextValue === undefined) {
        observer?.disconnect();
        observer = undefined;
        node.style.removeProperty('font-size');
      } else {
        layout = nextValue.layout;
        observe();
      }
    },
    destroy() {
      observer?.disconnect();
      cancelAnimationFrame(frame);
      node.style.removeProperty('font-size');
    }
  };
};