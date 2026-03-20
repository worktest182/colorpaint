(() => {
  if (typeof window === 'undefined') return;

  if (!Array.isArray(window.colorDatabase)) {
    window.colorDatabase = [];
  }
})();
