class Wishlist {
  constructor() {
    this.storageKey = 'cb-wishlist';
    this.items = this.getItems();
    
    // DOM Elements
    this.drawer = document.getElementById('WishlistDrawer');
    this.overlay = document.getElementById('WishlistOverlay');
    this.closeBtn = document.getElementById('WishlistClose');
    this.body = document.getElementById('WishlistBody');
    this.countBubbles = document.querySelectorAll('.wishlist-counter-element');
    
    this.initListeners();
    this.updateUI();
  }

  initListeners() {
    // Add to wishlist buttons on product grid
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.cb-wishlist-button');
      if (btn) {
        e.preventDefault();
        this.toggleItem(btn);
      }
      
      const headerIcon = e.target.closest('#wishlist-icon-bubble, #wishlist-icon-bubble-mobile');
      if (headerIcon) {
        e.preventDefault();
        this.openDrawer();
      }
      
      // Remove item from drawer
      const removeBtn = e.target.closest('.wishlist-item__remove');
      if (removeBtn) {
        const handle = removeBtn.dataset.handle;
        this.removeItem(handle);
      }
      // Add item to cart
      const cartBtn = e.target.closest('.wishlist-item__cart');
      if (cartBtn) {
        const handle = cartBtn.dataset.handle;
        const variantId = cartBtn.dataset.variantId;
        if (variantId) {
          this.addToCart(variantId, handle, cartBtn);
        }
      }
    });

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.closeDrawer());
    }

    if (this.overlay) {
      this.overlay.addEventListener('click', () => this.closeDrawer());
    }
  }

  addToCart(variantId, handle, btn) {
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Adding...';
    btn.disabled = true;

    let formData = {
      'items': [{
        'id': variantId,
        'quantity': 1
      }]
    };

    fetch(window.Shopify.routes.root + 'cart/add.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(formData)
    })
    .then(response => {
      if (response.ok) {
        this.removeItem(handle);
        window.location.href = window.Shopify.routes.root + 'cart';
      } else {
        btn.innerHTML = 'Error';
        setTimeout(() => {
          btn.innerHTML = originalText;
          btn.disabled = false;
        }, 2000);
      }
    })
    .catch((error) => {
      console.error('Error:', error);
      btn.innerHTML = 'Error';
      btn.disabled = false;
    });
  }

  getItems() {
    const list = localStorage.getItem(this.storageKey);
    return list ? JSON.parse(list) : [];
  }

  saveItems() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.items));
    this.updateUI();
  }

  toggleItem(btn) {
    const handle = btn.dataset.productHandle;
    const exists = this.items.some(item => item.handle === handle);

    if (exists) {
      this.items = this.items.filter(item => item.handle !== handle);
    } else {
      this.items.push({
        handle: handle,
        title: btn.dataset.productTitle,
        price: btn.dataset.productPrice,
        url: btn.dataset.productUrl,
        image: btn.dataset.productImage,
        variantId: btn.dataset.variantId
      });
    }
    
    this.saveItems();
    this.openDrawer();
  }

  removeItem(handle) {
    this.items = this.items.filter(item => item.handle !== handle);
    this.saveItems();
  }

  updateUI() {
    // Update active states on grid buttons
    const buttons = document.querySelectorAll('.cb-wishlist-button');
    buttons.forEach(btn => {
      const handle = btn.dataset.productHandle;
      if (this.items.some(item => item.handle === handle)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update Header Counter dynamically
    const countBubbles = document.querySelectorAll('.wishlist-counter-element');
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

    // Render Drawer items
    this.renderDrawer();
  }

  renderDrawer() {
    if (!this.body) return;

    // Remove existing items from body before re-rendering
    const existingItems = this.body.querySelectorAll('.wishlist-item');
    existingItems.forEach(el => el.remove());

    const emptyState = this.body.querySelector('.wishlist-drawer__empty');

    if (this.items.length === 0) {
      if (emptyState) emptyState.classList.remove('hide');
    } else {
      if (emptyState) emptyState.classList.add('hide');
      
      this.items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'wishlist-item';
        div.innerHTML = `
          <img src="${item.image}" alt="${item.title}" class="wishlist-item__image">
          <div class="wishlist-item__info">
            <a href="${item.url}" class="wishlist-item__title">${item.title}</a>
            <div class="wishlist-item__price">${item.price}</div>
            ${item.variantId ? `<button class="wishlist-item__cart button button--secondary button--small" data-handle="${item.handle}" data-variant-id="${item.variantId}" style="margin-top: 10px; padding: 5px 15px; min-height: unset; border: 1px solid #ddd;">Add to cart</button>` : ''}
          </div>
          <button class="wishlist-item__remove" data-handle="${item.handle}" aria-label="Remove item">
            <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 12L12 4M12 12L4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        `;
        this.body.insertBefore(div, this.body.firstChild); // Insert at top
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
  window.WishlistService = new Wishlist();
});
