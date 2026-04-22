class Wishlist {
  constructor() {
    this.storageKey = 'cb-wishlist';
    this.samplesStorageKey = 'cb-samples';
    this.samplesLimit = 5;
    this.items = this.getItems();
    this.productCache = new Map();
    this.isHydrating = false;

    // Drawer elements
    this.drawer = document.getElementById('WishlistDrawer');
    this.overlay = document.getElementById('WishlistOverlay');
    this.closeBtn = document.getElementById('WishlistClose');
    this.body = document.getElementById('WishlistBody');
    this.countBubbles = document.querySelectorAll('.wishlist-counter-element');

    // Wishlist page elements
    this.pageGrid = document.getElementById('WishlistPageGrid');
    this.pageEmpty = document.getElementById('WishlistPageEmpty');
    this.pageCount = document.getElementById('WishlistPageCount');
    this.savedItemsSection = document.querySelector('.cb-saved-items');
    this.sameDayIcon = this.savedItemsSection?.dataset.sameDayIcon || '';

    this.initListeners();
    this.updateUI();

    // Backfill older saved entries that may be missing image/url/title, so cards render correctly.
    this.hydrateMissingItemFields();
  }

  initListeners() {
    document.addEventListener('click', (e) => {
      const wishlistBtn = e.target.closest('.cb-wishlist-button');
      if (wishlistBtn) {
        e.preventDefault();
        this.toggleItem(wishlistBtn);
        return;
      }

      const headerIcon = e.target.closest('#wishlist-icon-bubble, #wishlist-icon-bubble-mobile');
      if (headerIcon) {
        e.preventDefault();
        this.openDrawer();
        return;
      }

      const drawerPageLink = e.target.closest('[data-open-wishlist-page]');
      if (drawerPageLink) {
        this.closeDrawer();
        return;
      }

      const moveToSamplesBtn = e.target.closest('.wishlist-page-card .cb-free-sample-btn');
      if (moveToSamplesBtn) {
        e.preventDefault();
        this.moveItemToSamples(moveToSamplesBtn.dataset.handle);
        return;
      }

      const removeBtn = e.target.closest('.wishlist-item__remove, .wishlist-page-card__remove');
      if (removeBtn) {
        e.preventDefault();
        this.removeItem(removeBtn.dataset.handle);
        return;
      }

      if (
        this.drawer &&
        this.drawer.classList.contains('active') &&
        (e.target === this.overlay ||
          e.target === this.drawer ||
          e.target.closest('.wishlist-drawer__overlay') ||
          e.target.classList.contains('wishlist-drawer-wrapper'))
      ) {
        this.closeDrawer();
      }
    });

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.closeDrawer());
    }

    if (this.overlay) {
      this.overlay.addEventListener('click', () => this.closeDrawer());
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
    } catch (error) {
      console.error('Error reading wishlist from localStorage:', error);
      return [];
    }
  }

  saveItems() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.items));
      this.updateUI();
    } catch (error) {
      console.error('Error saving wishlist to localStorage:', error);
    }
  }


  
  toggleItem(btn) {
    const handle = btn.dataset.productHandle;
    const exists = this.items.some((item) => item.handle === handle);

    if (exists) {
      this.items = this.items.filter((item) => item.handle !== handle);
    } else {
      this.items.push(this.buildItemFromDataset(btn.dataset));
    }

    this.saveItems();
    this.openDrawer();
  }

  removeItem(handle) {
    this.items = this.items.filter((item) => item.handle !== handle);
    this.saveItems();
  }

  moveItemToSamples(handle) {
    const item = this.items.find((entry) => entry.handle === handle);
    if (!item) return;

    let sampleItems = [];

    try {
      sampleItems = JSON.parse(localStorage.getItem(this.samplesStorageKey)) || [];
    } catch (error) {
      console.error('Error reading samples from localStorage:', error);
    }

    const alreadyExists = sampleItems.some((entry) => entry.handle === handle);
    if (!alreadyExists && sampleItems.length >= this.samplesLimit) {
      if (window.FreeSamplesService && typeof window.FreeSamplesService.showLimitMessage === 'function') {
        window.FreeSamplesService.showLimitMessage();
        window.FreeSamplesService.openDrawer();
      }
      return;
    }

    sampleItems = sampleItems.filter((entry) => entry.handle !== handle);
    sampleItems.push({
      ...item,
      displayPrice: 'Rs. 0.00',
      originalPrice: item.price || '',
      price: item.price || 'Rs. 0.00',
    });

    localStorage.setItem(this.samplesStorageKey, JSON.stringify(sampleItems));
    this.removeItem(handle);

    if (window.FreeSamplesService) {
      window.FreeSamplesService.items = sampleItems;
      window.FreeSamplesService.updateUI();
      if (typeof window.FreeSamplesService.openDrawer === 'function') {
        window.FreeSamplesService.openDrawer();
      }
    }
  }

  buildItemFromDataset(dataset) {
    const image = this.normalizeImageUrl(dataset.productImage || '');
    const swatchImage = this.normalizeImageUrl(dataset.productSwatchImage || '') || image;

    return {
      handle: dataset.productHandle || '',
      title: dataset.productTitle || 'Product',
      price: dataset.productPrice || '',
      url: dataset.productUrl || '#',
      image,
      comparePrice: dataset.productComparePrice || '',
      discount: dataset.productDiscount || '',
      sameDay: dataset.productSameDay === 'true',
      color: dataset.productColor || '',
      swatchImage,
      variantId: dataset.variantId || '',
    };
  }

  normalizeImageUrl(url) {
    const value = String(url || '').trim();
    if (!value) return '';
    if (value.startsWith('//')) return `https:${value}`;
    return value;
  }

  isRenderableImage(url) {
    const value = this.normalizeImageUrl(url);
    if (!value) return false;

    return (
      value.includes('/cdn/') ||
      /\.(avif|gif|jpe?g|png|svg|webp)(\?|$)/i.test(value)
    );
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
      (item) =>
        item?.handle &&
        (!this.isRenderableImage(item.image) || !item.url || !item.title || (!item.color && !this.isRenderableImage(item.swatchImage)))
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

        if (!this.isRenderableImage(target.image)) {
          const featured = product.featured_image || (Array.isArray(product.images) ? product.images[0] : '');
          const normalized = this.normalizeImageUrl(featured);
          if (normalized) {
            target.image = normalized;
            changed = true;
          }
        }

        if (!target.color && !this.isRenderableImage(target.swatchImage)) {
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

  updateUI() {
    document.querySelectorAll('.cb-wishlist-button').forEach((btn) => {
      const handle = btn.dataset.productHandle;
      btn.classList.toggle(
        'active',
        this.items.some((item) => item.handle === handle)
      );
    });

    const count = this.items.length;
    this.countBubbles = document.querySelectorAll('.wishlist-counter-element');
    this.countBubbles.forEach((bubble) => {
      if (count > 0) {
        bubble.classList.remove('hide');
        const span = bubble.querySelector('span[aria-hidden="true"]');
        if (span) span.textContent = count;
      } else {
        bubble.classList.add('hide');
      }
    });

    this.renderDrawer();
    this.renderPage();
  }

  renderDrawer() {
    if (!this.body) return;

    this.body.querySelectorAll('.wishlist-item').forEach((el) => el.remove());

    const emptyState = this.body.querySelector('.wishlist-drawer__empty');

    if (this.items.length === 0) {
      if (emptyState) emptyState.classList.remove('hide');
      return;
    }

    if (emptyState) emptyState.classList.add('hide');

    [...this.items].reverse().forEach((item) => {
      const div = document.createElement('div');
      div.className = 'wishlist-item';
      const imageUrl = this.normalizeImageUrl(item.swatchImage || item.image);
      div.innerHTML = `
        <div class="wishlist-item__image swatch-pinked" style="background-image: url('${imageUrl}'); display: block;" role="img" aria-label="${this.escapeHtml(item.title)}"></div>
        <div class="wishlist-item__info">
          <a href="${item.url}" class="wishlist-item__title">${this.escapeHtml(item.title)}</a>
          <div class="wishlist-item__price">${item.price}</div>
        </div>
        <button class="wishlist-item__remove" data-handle="${item.handle}" aria-label="Remove item">
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

    let sampleItems = [];
    try {
      sampleItems = JSON.parse(localStorage.getItem(this.samplesStorageKey)) || [];
    } catch (error) {
      console.error('Error reading samples from localStorage:', error);
    }

    [...this.items].reverse().forEach((item) => {
      const article = document.createElement('article');
      article.className = 'wishlist-page-card card-wrapper product-card-wrapper';
      const imageUrl = this.normalizeImageUrl(item.image || item.swatchImage);
      const swatchImage = this.normalizeImageUrl(item.swatchImage || imageUrl);
      const fallbackImageUrl = this.normalizeImageUrl(swatchImage || imageUrl);
      const samplesLimitReached =
        sampleItems.length >= this.samplesLimit &&
        !sampleItems.some((entry) => entry.handle === item.handle);
      article.innerHTML = `
        <div class="card card--product">
          <div class="card__inner ratio" style="--ratio-percent: 100%;">
            <div class="card__media">
              <a href="${item.url}" class="full-unstyled-link">
                <div class="media media--transparent media--hover-effect">
                  <img
                    src="${imageUrl}"
                    srcset="${imageUrl} 533w"
                    sizes="(min-width: 990px) calc((100vw - 130px) / 4), (min-width: 750px) calc((100vw - 120px) / 3), calc((100vw - 35px) / 2)"
                    alt="${this.escapeHtml(item.title)}"
                    class="motion-reduce wishlist-page-card__image"
                    loading="lazy"
                    width="533"
                    height="533"
                    onerror="this.onerror=null; this.src='${fallbackImageUrl}';"
                  >
                </div>
              </a>
            </div>
            ${
              Number(item.discount) > 0
                ? `<div class="cb-discount-badge">${item.discount}%<span>OFF</span></div>`
                : ''
            }
            ${
              item.sameDay && this.sameDayIcon
                ? `<div class="cb-same-day-badge">
                    <img
                      src="${this.sameDayIcon}"
                      alt="Same Day Delivery"
                      class="cb-same-day-icon"
                      width="120"
                      height="120"
                      loading="lazy"
                    >
                  </div>`
                : ''
            }
          </div>
          <div class="cb-product-card-body-wrapper">
            <div class="cb-product-card-body">
              <div class="cb-product-details">
                <div class="cb-product-title-wrapper">
                  <h3 class="cb-product-title">
                    <a href="${item.url}" class="full-unstyled-link">${this.escapeHtml(item.title)}</a>
                  </h3>
                  ${
                    item.color
                      ? `<div class="cb-color-swatch" style="background-color: ${item.color};"></div>`
                      : swatchImage
                        ? `<div class="cb-product-swatch-large" style="background-image: url(${swatchImage});"></div>`
                        : ''
                  }
                </div>
              </div>
            </div>
            <div class="cb-product-card-body-footer">
              <div class="cb-product-price-from">
                From
                <div class="cb-product-price">${item.price}</div>
              </div>
              <div class="cb-card-actions">
                <button class="cb-free-sample-btn" type="button" data-handle="${item.handle}" ${samplesLimitReached ? 'disabled aria-disabled="true" title="Maximum 5 free samples allowed"' : ''}>
                  Free Sample
                </button>
                <button
                  class="wishlist-page-card__remove"
                  type="button"
                  data-handle="${item.handle}"
                  aria-label="Remove from wishlist"
                >
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
  window.WishlistService = new Wishlist();
});
