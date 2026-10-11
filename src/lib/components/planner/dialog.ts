import type { Action } from 'svelte/action';

export const modal: Action<HTMLDialogElement, { focusDialog?: boolean; blurPreviousOnClose?: boolean } | undefined> = (node, options) => {
  const previous = document.activeElement;
  const overflow = document.body.style.overflow;
  node.showModal();
  if (options?.focusDialog) node.focus({ preventScroll: true });
  document.body.style.overflow = 'hidden';
  return {
    destroy() {
      node.close();
      document.body.style.overflow = overflow;
      if (options?.blurPreviousOnClose !== false && previous instanceof HTMLElement && previous.isConnected) previous.blur();
    }
  };
};
