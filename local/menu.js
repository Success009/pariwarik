const fConfig = {
  apiKey: "AIzaSyDlnzH1D7D7Q663eWE086ng_1KdP46MZEs",
  authDomain: "deep-freehold-389006.firebaseapp.com",
  databaseURL: "https://deep-freehold-389006-default-rtdb.firebaseio.com",
  projectId: "deep-freehold-389006",
  storageBucket: "deep-freehold-389006.appspot.com",
  messagingSenderId: "76562961838",
  appId: "1:76562961838:web:4d18b2f79d7eb9fd88243f",
  measurementId: "G-VZC36FJC24"
};

const _D = "luxaOgpc6Tkf6isDdWinBEUygQad7HFj9QIWL6U8IGzgeF880PJfQ01HNyg1FbHn__3b-hHHmUKJecv-DUkXDydlCm07Gf585QsfxONsja8gMHh25jH33ASPfMEd5qWAw8sf2LO7guUM5iTGEsbUvQ63kQmQBgxbH7Q96aEA7AoyRgJh-UFWiM0eLeugx4D7Jg-OqdeGavDYKnL1_uB9JmVzjijHwW4Ops7_5LEPJwzZ_PPktd5KdPoDTkgBNeEU0YJa0RY3nSZQKif0JdG2WBlNXgIPMOXkIaG4AI6SYJ9520rO_Qgf6-x9Y-zHz_fRgroglE2WDZFIQbwEyO9rHkvONuBLrxzNV7CbdfZ9af08x-Lj";
const _N = "table 1,table 2,table 3,table 4,hall 1,hall 2,hall 3,cabin 1,cabin 2,cabin 3,cabin 4,cabin 5,cabin 6,cabin up,terrace,top,room 101,room 102,room 103,room 104,room 201,room 202,room 203".split(',');

let allItems = [ ], cart = [ ], orderType = 'local', tableNumber = 'General', _currentUser = null, categoryOrder = [ ], selectedCategory = 'all', _isNavDragging = false;
const imageCache = { };
function getItemImageUrl(name) {
    if (!name) return '';
    const clean = name.replace(/\s+/g, '');
    return `https://firebasestorage.googleapis.com/v0/b/deep-freehold-389006.appspot.com/o/images%2F${encodeURIComponent(clean)}.jpg?alt=media`;
}

function handleImgError(img, cleanName) {
    if (!img) return;
    if (!img.dataset.retry) {
        img.dataset.retry = "png";
        img.src = `https://firebasestorage.googleapis.com/v0/b/deep-freehold-389006.appspot.com/o/images%2F${encodeURIComponent(cleanName)}.png?alt=media`;
    } else if (img.dataset.retry === "png") {
        img.dataset.retry = "lower";
        img.src = `https://firebasestorage.googleapis.com/v0/b/deep-freehold-389006.appspot.com/o/images%2F${encodeURIComponent(cleanName.toLowerCase())}.jpg?alt=media`;
    } else {
        img.style.display = 'none';
        if (img.previousElementSibling) {
            img.previousElementSibling.style.display = 'flex';
        }
    }
}
window.handleImgError = handleImgError;

function initApp() {
    closeAll();
    localStorage.setItem('order_type', 'local');
    const q = window.location.search.substring(1);
    if (q) {
        if (q.length === 16) {
            const i = _D.indexOf(q);
            if (i !== -1) {
                if (i % 16 === 0) {
                    localStorage.setItem('local_table', _N[i / 16]);
                    window.history.replaceState(null, null, window.location.pathname);
                }
            }
        }
    }
    tableNumber = localStorage.getItem('local_table') || 'General';
    const td = document.getElementById('tableDisplay');
    if (td) td.innerText = "Table: " + tableNumber;
    setTimeout(() => {
        const l = document.getElementById('loader');
        if (l) l.style.display = 'none';
    }, 1500);
    try {
        if (!firebase.apps.length) firebase.initializeApp(fConfig);
        const auth = firebase.auth();
        const db = firebase.database();
        auth.onAuthStateChanged(user => {
            _currentUser = user;
            if (!user) {
                auth.signInAnonymously().catch(err => console.error(err));
            } else {
                startHeartbeat(db, user.uid);
            }
            startListeners(db);
        });
    } catch (e) {
        console.error(e);
        const l = document.getElementById('loader');
        if (l) l.style.display = 'none';
    }
}

function toggleDrawer(id) {
    const dr = document.getElementById(id);
    const ov = document.getElementById('overlay');
    if (dr.classList.contains('active')) {
        closeAll();
    } else {
        document.querySelectorAll('.drawer').forEach(d => d.classList.remove('active'));
        ov.classList.add('active');
        dr.classList.add('active');
        if (id === 'regDrawerStep1') {
            const n = localStorage.getItem('order_name');
            if (n) document.getElementById('regName').value = n;
            const p = document.getElementById('regPhone');
            const l = document.getElementById('regLandmark');
            if (p) p.value = localStorage.getItem('local_phone') || '';
            if (l) l.value = localStorage.getItem('local_landmark') || '';
        }
    }
}

function closeAll() {
    document.querySelectorAll('.drawer').forEach(d => d.classList.remove('active'));
    const ov = document.getElementById('overlay');
    if (ov) ov.classList.remove('active');
}

function startHeartbeat(db, uid) {
    const presenceRef = db.ref(`presence/local/${uid}`);
    window.syncPresence = () => {
        if (!tableNumber || tableNumber === 'General') {
            tableNumber = localStorage.getItem('local_table') || 'General';
        }
        presenceRef.set({
            table: tableNumber,
            cart: cart,
            device: navigator.userAgent,
            lastSeen: firebase.database.ServerValue.TIMESTAMP
        });
    };
    syncPresence();
    setInterval(syncPresence, 5000);
    presenceRef.onDisconnect().remove();
}

// Utility to parse category order robustly from Firebase (handles both array and object formats)
function parseCategoryOrder(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'object') {
        return Object.keys(val)
            .sort((x, y) => parseInt(x) - parseInt(y))
            .map(k => val[k]);
    }
    return [];
}

function startListeners(db) {
    db.ref('menu/_categoryOrder').on('value', snap => {
        categoryOrder = parseCategoryOrder(snap.val());
        if (allItems.length > 0) renderItems();
    });

    db.ref('menu').on('value', snap => {
        allItems = [ ];
        snap.forEach(c => {
            if (c.key !== '_categoryOrder') {
                allItems.push({id: c.key, ...c.val()});
            }
        });
        renderItems();
    });
}

let renderTimeout;
function renderItems() {
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(_performRenderItems, 100);
}

function scrollCategoryNav(direction) {
    const nav = document.getElementById('categoryNav');
    if (!nav) return;
    const scrollAmount = Math.max(160, Math.floor(nav.clientWidth * 0.6));
    nav.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
    setTimeout(updateNavScrollButtons, 300);
}

function updateNavScrollButtons() {
    const nav = document.getElementById('categoryNav');
    const prevBtn = document.getElementById('catNavPrev');
    const nextBtn = document.getElementById('catNavNext');
    if (!nav) return;

    const hasOverflow = nav.scrollWidth > nav.clientWidth + 5;
    if (prevBtn) {
        prevBtn.style.display = hasOverflow ? 'flex' : 'none';
        const atStart = nav.scrollLeft <= 5;
        prevBtn.disabled = atStart;
        prevBtn.classList.toggle('disabled', atStart);
    }
    if (nextBtn) {
        nextBtn.style.display = hasOverflow ? 'flex' : 'none';
        const atEnd = nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 5;
        nextBtn.disabled = atEnd;
        nextBtn.classList.toggle('disabled', atEnd);
    }
}

function selectCategory(cat) {
    if (selectedCategory === cat && cat !== 'all') {
        selectedCategory = 'all';
    } else {
        selectedCategory = cat;
    }

    const nav = document.getElementById('categoryNav');
    if (nav) {
        const chips = nav.querySelectorAll('.category-chip');
        chips.forEach(chip => {
            if (chip.dataset.category === selectedCategory) {
                chip.classList.add('active');
                scrollCategoryChipIntoView(chip);
            } else {
                chip.classList.remove('active');
            }
        });
    }

    renderItems();

    const menuContent = document.getElementById('menuContent');
    if (menuContent) {
        const navSticky = document.querySelector('.nav-sticky');
        const offset = navSticky ? navSticky.offsetHeight + 10 : 130;
        const targetTop = menuContent.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
    }
}

function scrollCategoryChipIntoView(chip) {
    if (!chip) return;
    const nav = document.getElementById('categoryNav');
    if (!nav) return;
    const navRect = nav.getBoundingClientRect();
    const chipRect = chip.getBoundingClientRect();
    const currentScroll = nav.scrollLeft;
    const targetScroll = currentScroll + (chipRect.left - navRect.left) - (navRect.width / 2) + (chipRect.width / 2);
    nav.scrollTo({ left: targetScroll, behavior: 'smooth' });
}

function setupCategoryNavInteractions() {
    const nav = document.getElementById('categoryNav');
    if (!nav || nav.dataset.bound) return;
    nav.dataset.bound = 'true';

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let dragDistance = 0;

    nav.addEventListener('mousedown', (e) => {
        isDown = true;
        _isNavDragging = false;
        dragDistance = 0;
        nav.classList.add('grabbing');
        startX = e.pageX - nav.offsetLeft;
        scrollLeft = nav.scrollLeft;
    });

    nav.addEventListener('mouseleave', () => {
        isDown = false;
        nav.classList.remove('grabbing');
    });

    nav.addEventListener('mouseup', () => {
        isDown = false;
        nav.classList.remove('grabbing');
        setTimeout(() => { _isNavDragging = false; }, 60);
    });

    nav.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - nav.offsetLeft;
        const walk = (x - startX) * 1.5;
        dragDistance += Math.abs(walk);
        if (dragDistance > 6) {
            _isNavDragging = true;
        }
        nav.scrollLeft = scrollLeft - walk;
        updateNavScrollButtons();
    });

    nav.addEventListener('scroll', () => {
        updateNavScrollButtons();
    }, { passive: true });

    window.addEventListener('resize', () => {
        updateNavScrollButtons();
    });
}

function setupContentSwipeGestures() {
    const content = document.getElementById('menuContent');
    if (!content || content.dataset.swipeBound) return;
    content.dataset.swipeBound = 'true';

    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    content.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) {
            touchStartX = e.touches[0].screenX;
            touchStartY = e.touches[0].screenY;
        }
    }, { passive: true });

    content.addEventListener('touchend', (e) => {
        if (e.changedTouches.length > 0) {
            touchEndX = e.changedTouches[0].screenX;
            touchEndY = e.changedTouches[0].screenY;
            handleContentSwipe();
        }
    }, { passive: true });

    function handleContentSwipe() {
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;
        if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
            const nav = document.getElementById('categoryNav');
            if (!nav) return;
            const chips = Array.from(nav.querySelectorAll('.category-chip'));
            if (chips.length <= 1) return;
            const currentIndex = chips.findIndex(c => c.dataset.category === selectedCategory);
            if (currentIndex === -1) return;

            if (diffX < 0) {
                const nextIndex = (currentIndex + 1) % chips.length;
                selectCategory(chips[nextIndex].dataset.category);
            } else {
                const prevIndex = (currentIndex - 1 + chips.length) % chips.length;
                selectCategory(chips[prevIndex].dataset.category);
            }
        }
    }
}

function renderCategoryNav(sortedCats, categoryCounts, totalCount) {
    const nav = document.getElementById('categoryNav');
    if (!nav) return;

    setupCategoryNavInteractions();
    setupContentSwipeGestures();

    const existingChips = nav.querySelectorAll('.category-chip');
    const existingCats = Array.from(existingChips).map(c => c.dataset.category);
    const targetCats = ['all', ...sortedCats];

    const needsRebuild = existingCats.join('|||') !== targetCats.join('|||');

    if (needsRebuild) {
        nav.innerHTML = '';

        const allBtn = document.createElement('button');
        allBtn.type = 'button';
        allBtn.className = 'category-chip' + (selectedCategory === 'all' ? ' active' : '');
        allBtn.dataset.category = 'all';
        allBtn.innerHTML = `<span>All</span><span class="chip-count">${totalCount}</span>`;
        allBtn.onclick = () => {
            if (_isNavDragging) return;
            selectCategory('all');
        };
        nav.appendChild(allBtn);

        sortedCats.forEach(cat => {
            const count = categoryCounts[cat] || 0;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'category-chip' + (selectedCategory === cat ? ' active' : '');
            btn.dataset.category = cat;
            btn.innerHTML = `<span>${cat}</span><span class="chip-count">${count}</span>`;
            btn.onclick = () => {
                if (_isNavDragging) return;
                selectCategory(cat);
            };
            nav.appendChild(btn);
        });
    } else {
        existingChips.forEach(chip => {
            const cat = chip.dataset.category;
            const count = cat === 'all' ? totalCount : (categoryCounts[cat] || 0);
            const countEl = chip.querySelector('.chip-count');
            if (countEl) countEl.textContent = count;
            if (cat === selectedCategory) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });
    }

    updateNavScrollButtons();
}

function _performRenderItems() {
    const grid = document.getElementById('menuContent');
    if (!grid) return;
    const search = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase().trim() : '';
    const hotelItems = allItems.filter(i => i.type === 'Hotel');
    const filtered = hotelItems.filter(i => i.name.toLowerCase().includes(search));

    const allCategoriesMap = { };
    hotelItems.forEach(i => {
        const cat = (i.category || 'General').trim();
        if(!allCategoriesMap[cat]) allCategoriesMap[cat] = [ ];
        allCategoriesMap[cat].push(i);
    });

    const sortedCats = Object.keys(allCategoriesMap).sort((a, b) => {
        const order = Array.isArray(categoryOrder) ? categoryOrder : [];
        const getIndex = (cat) => {
            if (!cat) return -1;
            const c = cat.trim().toLowerCase();
            return order.findIndex(o => o && o.trim().toLowerCase() === c);
        };
        const indexA = getIndex(a);
        const indexB = getIndex(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    const categoryCounts = { };
    filtered.forEach(i => {
        const cat = (i.category || 'General').trim();
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    renderCategoryNav(sortedCats, categoryCounts, filtered.length);

    if (selectedCategory !== 'all' && !sortedCats.includes(selectedCategory)) {
        selectedCategory = 'all';
    }

    grid.innerHTML = '';
    if (!filtered.length) { 
        grid.innerHTML = '<div style="text-align:center; padding:3rem; opacity:0.5; grid-column: 1/-1;">No items found</div>'; 
        return; 
    }

    const filteredCats = { };
    filtered.forEach(i => {
        const cat = (i.category || 'General').trim();
        if(!filteredCats[cat]) filteredCats[cat] = [ ];
        filteredCats[cat].push(i);
    });

    let displayCats = sortedCats.filter(c => filteredCats[c] && filteredCats[c].length > 0);

    if (selectedCategory !== 'all') {
        const catItems = filteredCats[selectedCategory] || [];
        
        const filterHeader = document.createElement('div');
        filterHeader.className = 'category-filter-header';
        filterHeader.innerHTML = `
            <span>Showing <strong>${selectedCategory}</strong> (${catItems.length} items)</span>
            <button type="button" class="btn-clear-cat" onclick="selectCategory('all')">
                <i class="fas fa-times"></i> View All
            </button>
        `;
        grid.appendChild(filterHeader);

        if (!catItems.length) {
            const emptyNotice = document.createElement('div');
            emptyNotice.className = 'category-block';
            emptyNotice.innerHTML = `
                <div class="category-title">${selectedCategory}</div>
                <div style="text-align:center; padding:2.5rem 1rem; color:var(--text-muted);">
                    <i class="fas fa-search fa-2x" style="opacity:0.3; margin-bottom:12px; display:block;"></i>
                    <p>No items found ${search ? `matching "${search}"` : ''} in ${selectedCategory}.</p>
                    <button type="button" class="btn-clear-cat" style="margin-top:10px; border:1px solid var(--primary);" onclick="selectCategory('all')">View All Items</button>
                </div>
            `;
            grid.appendChild(emptyNotice);
            return;
        }

        displayCats = [selectedCategory];
    }

    displayCats.forEach(cName => {
        const items = filteredCats[cName] || [];
        if (!items.length) return;

        const section = document.createElement('div');
        section.className = 'category-block';
        section.innerHTML = `<div class="category-title">${cName}</div><div class="product-grid"></div>`;
        grid.appendChild(section);

        items.forEach(item => {
            const isOut = item.status === 'out_of_stock';
            let price = item.price; 
            if (item.discountPercent) {
                if (new Date(item.discountExpiry) > new Date()) {
                    price = (item.price * (1 - item.discountPercent / 100));
                }
            }
            const cartItem = cart.find(ci => ci.id === item.id);
            const card = document.createElement('div');
            card.className = 'card reveal active';
            card.style.animation = 'fadeUp 0.6s ease-out backwards';
            card.style.animationDelay = (filtered.indexOf(item) * 0.05) + 's';
            if (isOut) card.style.opacity = '0.6';
            const cleanName = item.name ? item.name.replace(/\s+/g, '') : '';
            const imgUrl = getItemImageUrl(item.name);
            imageCache[item.id] = imgUrl;
            card.innerHTML = `
                <div class="img-container">
                    <div class="img-fallback"><i class="fas fa-utensils"></i></div>
                    <img id="img-${item.id}" src="${imgUrl}" loading="lazy" onload="if(this.previousElementSibling) this.previousElementSibling.style.display='none';" onerror="handleImgError(this, '${cleanName.replace(/'/g, "\\'")}')">
                </div>
                <div class="card-body">
                    <div class="p-name">${item.name}</div>
                    <div class="p-price">Rs ${price.toFixed(2)}</div>
                    <div class="p-unit">${item.unit ? 'per ' + (item.startingValue || 1) + ' ' + item.unit : ''}</div>
                    <div id="ctrl-${item.id}" style="margin-top:auto;">
                        ${cartItem ? `
                            <div class="qty-controls">
                                <button class="qty-btn" onclick="updateQty('${item.id}', -1)">-</button>
                                <span style="font-weight:600;">${cartItem.qty}</span>
                                <button class="qty-btn" onclick="updateQty('${item.id}', 1)">+</button>
                            </div>
                        ` : `
                            <button class="btn-add" ${isOut?'disabled':''} onclick="addToCart('${item.id}')">${isOut?'Sold Out':'Add to Order'}</button>
                        `}
                    </div>
                </div>`;
            section.querySelector('.product-grid').appendChild(card);
        });
    });
}
function addToCart(id) {
    const item = allItems.find(i => i.id === id);
    let p = item.price;
    if (item.discountPercent) {
        if (new Date(item.discountExpiry) > new Date()) {
            p = (item.price * (1 - item.discountPercent / 100));
        }
    }
    cart.push({ id, name: item.name, price: p, qty: 1 });
    updateCartUI();
    renderItems();
}

function updateQty(id, dir) {
    const idx = cart.findIndex(c => c.id === id);
    if (idx === -1) return;
    cart[idx].qty += dir;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);
    updateCartUI();
    renderItems();
}

function updateCartUI() {
    if (window.syncPresence) window.syncPresence();
    let sub = 0;
    const list = document.getElementById('cartList');
    if (!list) return;
    list.innerHTML = cart.length ? '' : '<div style="text-align:center; padding:2rem; opacity:0.5;">Basket is empty</div>';
    cart.forEach(i => {
        const itemTotal = i.price * i.qty;
        sub += itemTotal;
        const imgUrl = imageCache[i.id] || '';
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
    if (totalEl) totalEl.innerText = sub.toFixed(2);
    if (badge) {
        badge.innerText = cart.length;
        badge.style.display = cart.length ? 'flex' : 'none';
    }
    document.getElementById('cartTotalDrawer').innerText = "Rs " + sub.toFixed(2);
}

function setOrderType(type) {
    orderType = type;
    localStorage.setItem('order_type', type);
    const hotelFields = document.getElementById('hotelFields');
    const localFields = document.getElementById('localFields');
    const btnHotel = document.getElementById('btnHotel');
    const btnLocal = document.getElementById('btnLocal');
    if (type === 'hotel') {
        hotelFields.style.display = 'block';
        localFields.style.display = 'none';
        btnHotel.classList.add('active');
        btnLocal.classList.remove('active');
    } else {
        hotelFields.style.display = 'none';
        localFields.style.display = 'block';
        btnHotel.classList.remove('active');
        btnLocal.classList.add('active');
    }
}

function checkRegistration() {
    if (!cart.length) return;
    const n = localStorage.getItem('order_name');
    const p = localStorage.getItem('local_phone');
    if (!n || !p) {
        toggleDrawer('regDrawerStep1');
    } else {
        toggleDrawer('confirmDrawer');
    }
}

function goToStep1() {
    toggleDrawer('regDrawerStep1');
}

function showModal(title, text, type = 'info') {
    const m = document.getElementById('customModal');
    const t = document.getElementById('modalTitle');
    const tx = document.getElementById('modalText');
    const ic = document.getElementById('modalIcon');
    const icon = m.querySelector('i');
    t.innerText = title;
    tx.innerText = text;
    ic.className = 'modal-icon ' + (type === 'success' ? 'success' : '');
    icon.className = type === 'success' ? 'fas fa-check' : 'fas fa-info-circle';
    m.classList.add('active');
}

function hideModal() {
    document.getElementById('customModal').classList.remove('active');
}

function goToStep2() {
    const n = document.getElementById('regName').value.trim();
    const p = document.getElementById('regPhone').value.trim();
    if (!n || !p) {
        return showModal("Required Info", "Please enter both your Full Name and Contact Number.");
    }
    toggleDrawer('regDrawerStep2');
}

function goToStep3() {
    toggleDrawer('regDrawerStep3');
}

function redirectToPartner() {
    window.location.href = "https://success009.github.io/bharatpur-bazar/";
}

function saveReg() {
    const n = document.getElementById('regName').value.trim();
    const p = document.getElementById('regPhone').value.trim();
    const l = document.getElementById('regLandmark').value.trim();
    if (!n || !p) return showModal("Required Info", "Please enter your name and phone number.");
    if (!l) return showModal("Required Info", "Please enter your nearest landmark.");
    localStorage.setItem('order_name', n);
    localStorage.setItem('order_type', 'online');
    localStorage.setItem('local_phone', p);
    localStorage.setItem('local_area', 'Bharatpur 10');
    localStorage.setItem('local_landmark', l);
    document.getElementById('confirmMsg').innerText = "Ready to confirm your delivery order?";
    document.getElementById('confirmSubMsg').innerText = "Our delivery partner will bring it to your doorstep.";
    toggleDrawer('confirmDrawer');
}

function finalizeOrder() {
    const auth = firebase.auth();
    const user = auth.currentUser;
    if (!user) {
        showModal("Connection Lost", "Please wait while we reconnect...", "info");
        auth.signInAnonymously().catch(err => showModal("Connection Error", err.message));
        return;
    }
    const order = { 
        customerName: "Table " + tableNumber, 
        orderType: 'local',
        tableNumber: tableNumber,
        device: navigator.userAgent,
        items: cart, 
        totalPrice: parseFloat(document.getElementById('mainTotal').innerText), 
        status: 'Ordered', 
        timestamp: new Date().toISOString() 
    };
    const path = `orders/local/${user.uid}`;
    firebase.database().ref(path).push(order).then(() => {
        showModal("Order Sent", "Your order has been received! We are preparing it for Table " + tableNumber, "success"); 
        cart = [ ]; 
        if (window.syncPresence) window.syncPresence();
        updateCartUI(); 
        renderItems(); 
        closeAll();
    }).catch(e => {
        console.error(e);
        showModal("Order Failed", "Could not place order. Please check your connection.");
    });
}

window.initApp = initApp;
window.toggleDrawer = toggleDrawer;
window.closeAll = closeAll;
window.addToCart = addToCart;
window.updateQty = updateQty;
window.checkRegistration = checkRegistration;
window.saveReg = saveReg;
window.goToStep1 = goToStep1;
window.goToStep2 = goToStep2;
window.goToStep3 = goToStep3;
window.redirectToPartner = redirectToPartner;
window.finalizeOrder = finalizeOrder;
window.hideModal = hideModal;
window.renderItems = renderItems;
window.selectCategory = selectCategory;
window.scrollCategoryNav = scrollCategoryNav;
window.setOrderType = setOrderType;

document.addEventListener('DOMContentLoaded', initApp);