(() => {
  const RESTORE_FLAG_KEY = 'cb-cart-restore';
  const BACKUP_KEY = 'cb-cart-backup';
  const FLOW_KEY = 'cb-samples-checkout-flow';
  const MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

  const readFlow = () => {
    try {
      const raw = localStorage.getItem(FLOW_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (!Array.isArray(parsed.codes)) return null;
      if (typeof parsed.step !== 'number') return null;
      return parsed;
    } catch (_) {
      return null;
    }
  };

  const readBackup = () => {
    try {
      const raw = localStorage.getItem(BACKUP_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (!Array.isArray(parsed.items)) return null;
      if (!parsed.createdAt || typeof parsed.createdAt !== 'number') return null;
      if (Date.now() - parsed.createdAt > MAX_AGE_MS) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  };

  const clearCart = async () => {
    await fetch('/cart/clear.js', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    });
  };

  const addToCart = async (items) => {
    if (!items || items.length === 0) return;
    const res = await fetch('/cart/add.js', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });

    if (!res.ok) {
      throw new Error('Failed to restore cart');
    }
  };

  const restoreCart = async () => {
    const shouldRestore = localStorage.getItem(RESTORE_FLAG_KEY) === '1';
    if (!shouldRestore) return;

    const flow = readFlow();
    // During the sample checkout redirect flow, do not restore while we're on cart/discount pages,
    // otherwise it races the redirect chain and prevents the second code from applying.
    if (flow) {
      const pathname = window.location.pathname || '/';
      if (pathname.startsWith('/cart') || pathname.startsWith('/discount')) return;
    }

    const backup = readBackup();
    if (!backup) {
      localStorage.removeItem(RESTORE_FLAG_KEY);
      localStorage.removeItem(BACKUP_KEY);
      localStorage.removeItem(FLOW_KEY);
      return;
    }

    try {
      await clearCart();
      await addToCart(
        backup.items.map((it) => ({
          id: it.id,
          quantity: it.quantity,
          properties: it.properties,
        }))
      );

      localStorage.removeItem(RESTORE_FLAG_KEY);
      localStorage.removeItem(BACKUP_KEY);
      localStorage.removeItem(FLOW_KEY);
    } catch (_) {
      // Keep flags so we can retry on next page load.
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    restoreCart();
  });
})();
