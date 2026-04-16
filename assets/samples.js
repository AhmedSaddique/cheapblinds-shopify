class FreeSamples {
  constructor() {
    this.storageKey = 'cb-samples';
    this.maxItems = 5;
    this.items = this.getItems();
    this.productCache = new Map();
    this.isHydrating = false;

    // Drawer elements
    this.drawer = document.getElementById('SamplesDrawer');
    this.overlay = document.getElementById('SamplesOverlay');
    this.closeBtn = document.getElementById('SamplesClose');
    this.body = document.getElementById('SamplesBody');
    this.limitMessage = document.getElementById('SamplesLimitMessage');

    // Samples page elements
    this.pageGrid = document.getElementById('SamplesPageGrid');
    this.pageEmpty = document.getElementById('SamplesPageEmpty');
    this.pageCount = document.getElementById('SamplesPageCount');

    this.initListeners();
    this.updateUI();

    // Backfill older saved entries that may be missing image/url/title, so cards render correctly.
    this.hydrateMissingItemFields();
  }

  initListeners() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.cb-free-sample-btn');
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        this.toggleItem(btn);
        return;
      }

      const headerIcon = e.target.closest('#samples-icon-bubble, #samples-icon-bubble-mobile');
      if (headerIcon) {
        e.preventDefault();
        e.stopPropagation();
        this.openDrawer();
        return;
      }

      const drawerPageLink = e.target.closest('[data-open-samples-page]');
      if (drawerPageLink) {
        this.closeDrawer();
        return;
      }

      const removeBtn = e.target.closest('.samples-item__remove, .samples-page-card__remove');
      if (removeBtn) {
        e.preventDefault();
        this.removeItem(removeBtn.dataset.handle);
        return;
      }

      if (
        this.drawer &&
        this.drawer.classList.contains('active') &&
        (e.target === this.overlay ||
          e.target.closest('.samples-drawer__overlay') ||
          e.target === this.drawer ||
          e.target.classList.contains('samples-drawer-wrapper'))
      ) {
        this.closeDrawer();
      }
    });

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeDrawer();
      });
    }

    window.addEventListener('storage', (event) => {
      if (event.key === this.storageKey) {
        this.items = this.getItems();
        this.updateUI();
      }
    });
  }

  getItems() {
    try {
      const list = localStorage.getItem(this.storageKey);
      return list ? JSON.parse(list) : [];
    } catch (e) {
      console.error('Error reading samples from localStorage:', e);
      return [];
    }
  }

  saveItems() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.items));
      this.updateUI();
    } catch (e) {
      console.error('Error saving samples to localStorage:', e);
    }
  }

  toggleItem(btn) {
    const handle = btn.dataset.productHandle;
    if (!handle) return;

    const exists = this.items.some((item) => item.handle === handle);

    if (exists) {
      this.items = this.items.filter((item) => item.handle !== handle);
    } else {
      if (this.items.length >= this.maxItems) {
        this.showLimitMessage();
        this.openDrawer();
        return;
      }

      this.items.push({
        handle,
        title: btn.dataset.productTitle || 'Product',
        price: btn.dataset.productPrice || 'Rs. 0.00',
        displayPrice: 'Rs. 0.00',
        originalPrice: btn.dataset.productPrice || '',
        url: btn.dataset.productUrl || '#',
        image: this.normalizeImageUrl(btn.dataset.productImage || ''),
        color: btn.dataset.productColor || '',
        swatchImage: this.normalizeImageUrl(btn.dataset.productSwatchImage || '') || this.normalizeImageUrl(btn.dataset.productImage || ''),
      });
    }

    this.saveItems();
    this.openDrawer();
  }

  normalizeImageUrl(url) {
    const value = String(url || '').trim();
    if (!value) return '';
    if (value.startsWith('//')) return `https:${value}`;
    return value;
  }

  async fetchProduct(handle) {
    const key = String(handle || '').trim();
    if (!key) return null;

    if (this.productCache.has(key)) {
      return this.productCache.get(key);
    }

    const root = window?.Shopify?.routes?.root || '/';
    const rootWithSlash = root.endsWith('/') ? root : `${root}/`;
    const url = `${rootWithSlash}products/${encodeURIComponent(key)}.js`;

    const request = fetch(url, { headers: { Accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);

    this.productCache.set(key, request);
    return request;
  }

  async hydrateMissingItemFields() {
    if (this.isHydrating) return;

    const needsHydration = this.items.filter(
      (item) => item?.handle && (!item.image || !item.url || !item.title)
    );

    if (needsHydration.length === 0) return;

    this.isHydrating = true;

    try {
      const results = await Promise.allSettled(
        needsHydration.map((item) => this.fetchProduct(item.handle))
      );

      let changed = false;

      results.forEach((result, index) => {
        if (result.status !== 'fulfilled' || !result.value) return;

        const product = result.value;
        const handle = needsHydration[index]?.handle;
        const target = this.items.find((entry) => entry.handle === handle);
        if (!target) return;

        if (!target.title && product.title) {
          target.title = product.title;
          changed = true;
        }

        if (!target.url && product.url) {
          target.url = product.url;
          changed = true;
        }

        if (!target.image) {
          const featured = product.featured_image || (Array.isArray(product.images) ? product.images[0] : '');
          const normalized = this.normalizeImageUrl(featured);
          if (normalized) {
            target.image = normalized;
            changed = true;
          }
        }

        if (!target.swatchImage && !target.color) {
          const fallbackSwatch = this.normalizeImageUrl(target.image);
          if (fallbackSwatch) {
            target.swatchImage = fallbackSwatch;
            changed = true;
          }
        }
      });

      if (changed) {
        localStorage.setItem(this.storageKey, JSON.stringify(this.items));
        this.updateUI();
      }
    } finally {
      this.isHydrating = false;
    }
  }

  removeItem(handle) {
    this.items = this.items.filter((item) => item.handle !== handle);
    this.saveItems();
  }

  showLimitMessage() {
    if (!this.limitMessage) return;

    this.limitMessage.textContent = `You can add up to ${this.maxItems} free samples only.`;
    this.limitMessage.classList.remove('hide');
  }

  updateUI() {
    document.querySelectorAll('.cb-free-sample-btn').forEach((btn) => {
      const handle = btn.dataset.productHandle;
      if (handle) {
        const isActive = this.items.some((item) => item.handle === handle);
        const isAtLimit = this.items.length >= this.maxItems;
        btn.classList.toggle('active', isActive);
        btn.disabled = !isActive && isAtLimit;
        btn.setAttribute(
          'aria-disabled',
          !isActive && isAtLimit ? 'true' : 'false'
        );
        if (!isActive && isAtLimit) {
          btn.title = `Maximum ${this.maxItems} free samples allowed`;
        } else {
          btn.removeAttribute('title');
        }
      }
    });

    const countBubbles = document.querySelectorAll('.samples-counter-element');
    const count = this.items.length;
    countBubbles.forEach((bubble) => {
      if (count > 0) {
        bubble.classList.remove('hide');
        const span = bubble.querySelector('span[aria-hidden="true"]');
        if (span) span.textContent = count;
      } else {
        bubble.classList.add('hide');
      }
    });

    if (this.limitMessage) {
      this.limitMessage.classList.toggle('hide', count < this.maxItems);
      if (count >= this.maxItems) {
        this.limitMessage.textContent = `You have reached the ${this.maxItems} free sample limit.`;
      }
    }

    this.renderDrawer();
    this.renderPage();
  }

  renderDrawer() {
    if (!this.body) return;

    this.body.querySelectorAll('.samples-item').forEach((el) => el.remove());

    const emptyState = this.body.querySelector('.samples-drawer__empty');

    if (this.items.length === 0) {
      if (emptyState) emptyState.classList.remove('hide');
      return;
    }

    if (emptyState) emptyState.classList.add('hide');

    [...this.items].reverse().forEach((item) => {
      const div = document.createElement('div');
      div.className = 'samples-item';
      const imageUrl = this.normalizeImageUrl(item.image);
      div.innerHTML = `
        <img src="${imageUrl}" alt="${this.escapeHtml(item.title)}" class="samples-item__image" loading="lazy">
        <div class="samples-item__info">
          <a href="${item.url}" class="samples-item__title">${this.escapeHtml(item.title)}</a>
          <div class="samples-item__price">${item.displayPrice || 'Rs. 0.00'}</div>
        </div>
        <button class="samples-item__remove" data-handle="${item.handle}" aria-label="Remove sample">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 9V18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            <path d="M16 9V18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            <path d="M5 6H19" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            <path d="M10 4H14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            <path d="M7 6L8 20H16L17 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      `;
      this.body.insertBefore(div, this.body.firstChild);
    });
  }

  renderPage() {
    if (!this.pageGrid) return;

    this.pageGrid.innerHTML = '';

    if (this.pageCount) {
      this.pageCount.textContent = `${this.items.length} Item(s)`;
    }

    if (this.items.length === 0) {
      if (this.pageEmpty) this.pageEmpty.classList.remove('hide');
      return;
    }

    if (this.pageEmpty) this.pageEmpty.classList.add('hide');

    [...this.items].reverse().forEach((item) => {
      const article = document.createElement('article');
      article.className = 'samples-page-card';
      const imageUrl = this.normalizeImageUrl(item.image);
      article.innerHTML = `
        <a href="${item.url}" class="samples-page-card__image-link">
          <img src="${imageUrl}" alt="${this.escapeHtml(item.title)}" class="samples-page-card__image" loading="lazy">
        </a>
        <div class="samples-page-card__content">
          <a href="${item.url}" class="samples-page-card__title">${this.escapeHtml(item.title)}</a>
          <div class="samples-page-card__price">
            <span class="samples-page-card__label">Price</span>
            <span class="samples-page-card__value">${item.displayPrice || 'Rs. 0.00'}</span>
          </div>
          <div class="samples-page-card__actions">
            <a href="${item.url}" class="samples-page-card__button">View product</a>
            <button type="button" class="samples-page-card__remove" data-handle="${item.handle}" aria-label="Remove free sample">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 9V18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                <path d="M16 9V18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                <path d="M5 6H19" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                <path d="M10 4H14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                <path d="M7 6L8 20H16L17 6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      `;
      this.pageGrid.appendChild(article);
    });
  }

  openDrawer() {
    if (this.drawer) {
      this.drawer.classList.add('active');
      document.body.classList.add('overflow-hidden');
    }
  }

  closeDrawer() {
    if (this.drawer) {
      this.drawer.classList.remove('active');
      document.body.classList.remove('overflow-hidden');
    }
  }

  escapeHtml(value) {
    return String(value || '');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.FreeSamplesService = new FreeSamples();
});
