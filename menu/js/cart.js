// Cart management operations and drawer controls
function toggleDrawer(id) {
    const dr = document.getElementById(id);
    const ov = document.getElementById('overlay');
    
    if(!dr) return;
    
    if(dr.classList.contains('active')) {
        closeAll();
    } else {
        // Close other drawers but keep overlay active
        document.querySelectorAll('.drawer').forEach(d => d.classList.remove('active'));
        
        if(ov) ov.classList.add('active');
        dr.classList.add('active');

        // If opening registration, sync data
        if(id === 'regDrawerStep1') {
            const name = localStorage.getItem('order_name');
            const regNameInput = document.getElementById('regName');
            if(name && regNameInput) regNameInput.value = name;
            
            const phoneEl = document.getElementById('regPhone');
            const landmarkEl = document.getElementById('regLandmark');
            if(phoneEl) phoneEl.value = localStorage.getItem('local_phone') || '';
            if(landmarkEl) landmarkEl.value = localStorage.getItem('local_landmark') || '';
        }
    }
}

function closeAll() {
    document.querySelectorAll('.drawer').forEach(d => d.classList.remove('active'));
    const ov = document.getElementById('overlay');
    if(ov) ov.classList.remove('active');
}

function addToCart(id) {
    const item = window.allItems.find(i => i.id === id);
    if (!item) return;
    let p = item.price;
    if(item.discountPercent && new Date(item.discountExpiry) > new Date()) {
        p = (item.price * (1 - item.discountPercent / 100));
    }
    
    window.cart.push({ id, name: item.name, price: p, qty: 1 });
    updateCartUI();
    if (typeof renderItems === 'function') renderItems();
}

function updateQty(id, dir) {
    const idx = window.cart.findIndex(c => c.id === id);
    if(idx === -1) return;
    window.cart[idx].qty += dir;
    if(window.cart[idx].qty <= 0) window.cart.splice(idx, 1);
    updateCartUI();
    if (typeof renderItems === 'function') renderItems();
}

function updateCartUI() {
    let sub = 0;
    const list = document.getElementById('cartList');
    if(!list) return;

    list.innerHTML = window.cart.length ? '' : '<div style="text-align:center; padding:2rem; opacity:0.5;">Basket is empty</div>';
    
    window.cart.forEach(i => {
        const itemTotal = i.price * i.qty;
        sub += itemTotal;
        const imgUrl = window.imageCache[i.id] || '';
        
        list.innerHTML += `
        <div class="cart-item-row">
            <div class="cart-item-img-container">
                ${imgUrl ? `<img src="${imgUrl}" class="cart-item-img">` : `<div class="cart-item-img-placeholder"><i class="fas fa-utensils"></i></div>`}
            </div>
            <div class="cart-item-details">
                <div class="cart-item-name">${i.name}</div>
                <div class="cart-item-price">Rs ${itemTotal.toFixed(2)}</div>
            </div>
            <div class="qty-controls-cart">
                <button class="qty-btn-cart" onclick="updateQty('${i.id}',-1)">-</button>
                <span style="font-weight:700; font-size:0.9rem; min-width:20px; text-align:center;">${i.qty}</span>
                <button class="qty-btn-cart" onclick="updateQty('${i.id}',1)">+</button>
            </div>
        </div>`;
    });

    const totalEl = document.getElementById('mainTotal');
    const badge = document.getElementById('cartBadge');
    
    if(totalEl) totalEl.innerText = sub.toFixed(2);
    if(badge) {
        badge.innerText = window.cart.length;
        badge.style.display = window.cart.length ? 'flex' : 'none';
    }
    
    // Update drawer totals
    const cartTotalDrawer = document.getElementById('cartTotalDrawer');
    if (cartTotalDrawer) cartTotalDrawer.innerText = "Rs " + sub.toFixed(2);
}

// Bind to window for global exposure
window.toggleDrawer = toggleDrawer;
window.closeAll = closeAll;
window.addToCart = addToCart;
window.updateQty = updateQty;
window.updateCartUI = updateCartUI;
