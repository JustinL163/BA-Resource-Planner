(() => {
  const disableImageDragging = (node) => {
    if (!(node instanceof Element)) return;

    if (node instanceof HTMLImageElement) node.setAttribute('draggable', 'false');
    node.querySelectorAll('img').forEach((image) => image.setAttribute('draggable', 'false'));
  };

  disableImageDragging(document.documentElement);

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) disableImageDragging(node);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener('dragstart', (event) => {
    if (event.target instanceof HTMLImageElement) event.preventDefault();
  }, true);
})();
