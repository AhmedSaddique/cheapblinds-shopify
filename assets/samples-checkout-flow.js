(() => {
  const FLOW_KEY = 'cb-samples-checkout-flow';
  const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

  const readFlow = () => {
    try {
      const raw = localStorage.getItem(FLOW_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (!Array.isArray(parsed.codes)) return null;
      if (typeof parsed.step !== 'number') return null;
      if (!parsed.startedAt || typeof parsed.startedAt !== 'number') return null;
      if (Date.now() - parsed.startedAt > MAX_AGE_MS) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  };

  const writeFlow = (flow) => {
    try {
      localStorage.setItem(FLOW_KEY, JSON.stringify(flow));
    } catch (_) {
      // ignore
    }
  };

  const clearFlow = () => {
    try {
      localStorage.removeItem(FLOW_KEY);
    } catch (_) {
      // ignore
    }
  };

  const rootPath = () => {
    const root = window?.Shopify?.routes?.root || '/';
    return root.endsWith('/') ? root.slice(0, -1) : root;
  };

  const pathWithRoot = (path) => `${rootPath()}${path.startsWith('/') ? path : `/${path}`}`;

  const buildDiscountUrl = (code, redirectTo) => {
    const base = pathWithRoot(`/discount/${encodeURIComponent(String(code || '').trim())}`);
    // Shopify discount permalinks work most reliably with relative redirects (not absolute URLs).
    return `${base}?redirect=${encodeURIComponent(redirectTo)}`;
  };

  const normalizedPathname = () => {
    const root = rootPath();
    const pathname = window.location.pathname || '/';
    if (root && root !== '/' && pathname.startsWith(root)) {
      const rest = pathname.slice(root.length);
      return rest.startsWith('/') ? rest : `/${rest}`;
    }
    return pathname;
  };

  const run = () => {
    const flow = readFlow();
    if (!flow) return;

    const codes = flow.codes.map((c) => String(c || '').trim()).filter(Boolean);
    if (codes.length === 0) {
      clearFlow();
      return;
    }

    const pathname = normalizedPathname();
    const cartPath = '/cart';

    // Step meanings:
    // 0 -> We applied CODE[0] and are now on /cart, next we should apply remaining code(s) and head to /checkout
    // 1 -> We attempted to head to /checkout with last code; next storefront load should restore the cart (cart-restore.js)
    if (flow.step === 0) {
      // Wait until we're on cart before applying the next code, to avoid loops.
      if (!pathname.startsWith(cartPath)) return;

      if (codes.length === 1) {
        // Single code: go straight to checkout.
        writeFlow({ ...flow, step: 1 });
        window.location.href = buildDiscountUrl(codes[0], pathWithRoot('/checkout'));
        return;
      }

      // Apply the remaining codes (in order) and finally redirect to checkout.
      // Use sequential client-side redirects (Shopify applies one code per /discount/ visit).
      writeFlow({ ...flow, step: 1 });
      // Second code (usually shipping) -> checkout.
      window.location.href = buildDiscountUrl(codes[1], pathWithRoot('/checkout'));
      return;
    }

    // If we ever land back on the storefront while step=1, do nothing.
    // cart-restore.js will restore the original cart and clear flags.
  };

  document.addEventListener('DOMContentLoaded', run);
})();
