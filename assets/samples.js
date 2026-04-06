class FreeSamples {
  constructor() {
    this.storageKey = 'cb-samples';
    this.items = this.getItems();

    // DOM Elements
    this.drawer = document.getElementById('SamplesDrawer');
    this.overlay = document.getElementById('SamplesOverlay');
    this.closeBtn = document.getElementById('SamplesClose');
    this.body = document.getElementById('SamplesBody');

    if (!this.drawer) {
      console.warn('SamplesDrawer element not found');
    }

    this.initListeners();
    this.updateUI();
  }

  initListeners() {
    document.addEventListener('click', (e) => {
      // Free Sample button on product card
      const btn = e.target.closest('.cb-free-sample-btn');
      if (btn) {
        console.log('Free Sample button clicked:', btn.dataset.productHandle);
        e.preventDefault();
        e.stopPropagation();
        this.toggleItem(btn);
        return;
      }

      // Header icon — desktop & mobile
      const headerIcon = e.target.closest('#samples-icon-bubble, #samples-icon-bubble-mobile');
      if (headerIcon) {
        console.log('Samples header icon clicked');
        e.preventDefault();
        e.stopPropagation();
        this.openDrawer();
        return;
      }

      // Remove item from drawer
      const removeBtn = e.target.closest('.samples-item__remove');
      if (removeBtn) {
        console.log('Remove sample clicked:', removeBtn.dataset.handle);
        this.removeItem(removeBtn.dataset.handle);
        return;
      }

      // Close on overlay / wrapper click
      if (this.drawer && this.drawer.classList.contains('active')) {
        if (
          e.target === this.overlay ||
          e.target.closest('.samples-drawer__overlay') ||
          e.target === this.drawer ||
          e.target.classList.contains('samples-drawer-wrapper')
        ) {
          console.log('Closing samples drawer from overlay/wrapper click');
          this.closeDrawer();
        }
      }
    });

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeDrawer();
      });
    }
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
    if (!handle) {
      console.error('Button missing data-product-handle');
      return;
    }

    const exists = this.items.some(item => item.handle === handle);

    if (exists) {
      this.items = this.items.filter(item => item.handle !== handle);
      console.log('Removed from samples:', handle);
    } else {
      this.items.push({
        handle: handle,
        title: btn.dataset.productTitle || 'Product',
        price: btn.dataset.productPrice || '',
        url: btn.dataset.productUrl || '#',
        image: btn.dataset.productImage || '',
      });
      console.log('Added to samples:', handle);
    }

    this.saveItems();
    this.openDrawer();
  }

  removeItem(handle) {
    this.items = this.items.filter(item => item.handle !== handle);
    this.saveItems();
  }

  updateUI() {
    // Update active state on product card buttons
    document.querySelectorAll('.cb-free-sample-btn').forEach(btn => {
      const handle = btn.dataset.productHandle;
      if (handle) {
        const isActive = this.items.some(i => i.handle === handle);
        btn.classList.toggle('active', isActive);
      }
    });

    // Update counter bubbles
    const countBubbles = document.querySelectorAll('.samples-counter-element');
    const count = this.items.length;
    countBubbles.forEach(bubble => {
      if (count > 0) {
        bubble.classList.remove('hide');
        const span = bubble.querySelector('span[aria-hidden="true"]');
        if (span) span.textContent = count;
      } else {
        bubble.classList.add('hide');
      }
    });

    this.renderDrawer();
  }

  renderDrawer() {
    if (!this.body) return;

    // Clear existing items (only those with samples-item class)
    this.body.querySelectorAll('.samples-item').forEach(el => el.remove());

    const emptyState = this.body.querySelector('.samples-drawer__empty');

    if (this.items.length === 0) {
      if (emptyState) emptyState.classList.remove('hide');
    } else {
      if (emptyState) emptyState.classList.add('hide');

      this.items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'samples-item';
        div.innerHTML = `
          <img src="${item.image}" alt="${item.title}" class="samples-item__image">
          <div class="samples-item__info">
            <a href="${item.url}" class="samples-item__title">${item.title}</a>
            <div class="samples-item__price">${item.price}</div>
          </div>
          <button class="samples-item__remove" data-handle="${item.handle}" aria-label="Remove sample">
            <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 12L12 4M12 12L4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        `;
        this.body.insertBefore(div, this.body.firstChild);
      });
    }
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
}

document.addEventListener('DOMContentLoaded', () => {
  window.FreeSamplesService = new FreeSamples();
});
