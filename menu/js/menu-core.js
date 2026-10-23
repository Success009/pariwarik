// Global state configuration and initializations
window.fConfig = {
  apiKey: "AIzaSyDlnzH1D7D7Q663eWE086ng_1KdP46MZEs",
  authDomain: "deep-freehold-389006.firebaseapp.com",
  databaseURL: "https://deep-freehold-389006-default-rtdb.firebaseio.com",
  projectId: "deep-freehold-389006",
  storageBucket: "deep-freehold-389006.appspot.com",
  messagingSenderId: "76562961838",
  appId: "1:76562961838:web:4d18b2f79d7eb9fd88243f",
  measurementId: "G-VZC36FJC24"
};

window.allItems = [ ];
window.cart = [ ];
window.orderType = 'online';
window.categoryOrder = [ ];
window.selectedCategory = 'all';
window.imageCache = { };
window._currentUser = null;
window._isNavDragging = false;
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
    if (typeof closeAll === 'function') closeAll();
    localStorage.setItem('order_type', 'online');
    setTimeout(() => {
        const loader = document.getElementById('loader');
        if(loader) loader.style.display = 'none';
    }, 1500);
    try {
        if (!firebase.apps.length) firebase.initializeApp(window.fConfig);
        const auth = firebase.auth();
        const db = firebase.database();

        // Listen for Auth changes and capture the user object immediately
        auth.onAuthStateChanged(user => {
            console.log("Auth State:", user ? "Connected as " + user.uid : "Disconnected");
            window._currentUser = user;
            if(!user) {
                auth.signInAnonymously().catch(err => {
                    console.error("Auth Error:", err.code, err.message);
                    if(err.code === 'auth/operation-not-allowed') {
                        showModal("Configuration Required", "Anonymous Sign-in is not enabled in your Firebase Console. Please go to Authentication -> Sign-in Method and enable 'Anonymous'.");
                    } else if(window.location.protocol === 'file:') {
                        showModal("Local File Detected", "Firebase Authentication requires a web server. Please run the local server and open http://localhost:8000");
                    }
                });
            }
            startListeners(db);
        });
    } catch (e) {
        console.error("Firebase Initialization Error:", e);
        const loader = document.getElementById('loader');
        if (loader) loader.style.display = 'none';
    }
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
    // Fetch category order settings
    db.ref('menu/_categoryOrder').on('value', snap => {
        window.categoryOrder = parseCategoryOrder(snap.val());
        if (window.allItems.length > 0) renderItems();
    });

    // Fetch all menu items
    db.ref('menu').on('value', snap => {
        window.allItems = [ ];
        snap.forEach(c => {
            if (c.key !== '_categoryOrder') {
                const i = c.val();
                window.allItems.push({id: c.key, ...i});
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
    if (window.selectedCategory === cat && cat !== 'all') {
        window.selectedCategory = 'all';
    } else {
        window.selectedCategory = cat;
    }

    // Update active class on chips and center selected chip
    const nav = document.getElementById('categoryNav');
    if (nav) {
        const chips = nav.querySelectorAll('.category-chip');
        chips.forEach(chip => {
            if (chip.dataset.category === window.selectedCategory) {
                chip.classList.add('active');
                scrollCategoryChipIntoView(chip);
            } else {
                chip.classList.remove('active');
            }
        });
    }

    renderItems();

    // Scroll smoothly to top of menu content
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
        window._isNavDragging = false;
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
        setTimeout(() => { window._isNavDragging = false; }, 60);
    });

    nav.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - nav.offsetLeft;
        const walk = (x - startX) * 1.5;
        dragDistance += Math.abs(walk);
        if (dragDistance > 6) {
            window._isNavDragging = true;
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
        // Require horizontal swipe of at least 60px and significantly horizontal
        if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
            const nav = document.getElementById('categoryNav');
            if (!nav) return;
            const chips = Array.from(nav.querySelectorAll('.category-chip'));
            if (chips.length <= 1) return;
            const currentIndex = chips.findIndex(c => c.dataset.category === window.selectedCategory);
            if (currentIndex === -1) return;

            if (diffX < 0) {
                // Swiped Left -> View next category
                const nextIndex = (currentIndex + 1) % chips.length;
                selectCategory(chips[nextIndex].dataset.category);
            } else {
                // Swiped Right -> View previous category
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

        // "All" chip
        const allBtn = document.createElement('button');
        allBtn.type = 'button';
        allBtn.className = 'category-chip' + (window.selectedCategory === 'all' ? ' active' : '');
        allBtn.dataset.category = 'all';
        allBtn.innerHTML = `<span>All</span><span class="chip-count">${totalCount}</span>`;
        allBtn.onclick = () => {
            if (window._isNavDragging) return;
            selectCategory('all');
        };
        nav.appendChild(allBtn);

        sortedCats.forEach(cat => {
            const count = categoryCounts[cat] || 0;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'category-chip' + (window.selectedCategory === cat ? ' active' : '');
            btn.dataset.category = cat;
            btn.innerHTML = `<span>${cat}</span><span class="chip-count">${count}</span>`;
            btn.onclick = () => {
                if (window._isNavDragging) return;
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
            if (cat === window.selectedCategory) {
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
    if(!grid) return;

    const searchInput = document.getElementById('searchInput');
    const search = searchInput ? searchInput.value.toLowerCase().trim() : '';

    // STRICT FILTER: Type must be 'Hotel'
    const hotelItems = window.allItems.filter(i => i.type === 'Hotel');
    const filtered = hotelItems.filter(i => i.name.toLowerCase().includes(search));

    // Extract all hotel categories and sort by window.categoryOrder
    const allCategoriesMap = { };
    hotelItems.forEach(i => {
        const cat = (i.category || 'General').trim();
        if(!allCategoriesMap[cat]) allCategoriesMap[cat] = [ ];
        allCategoriesMap[cat].push(i);
    });

    const sortedCats = Object.keys(allCategoriesMap).sort((a, b) => {
        const order = Array.isArray(window.categoryOrder) ? window.categoryOrder : [];
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

    // Compute category counts for current search query
    const categoryCounts = { };
    filtered.forEach(i => {
        const cat = (i.category || 'General').trim();
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    // Render the swipeable category navigation bar
    renderCategoryNav(sortedCats, categoryCounts, filtered.length);

    // If selected category is no longer valid, fallback to 'all'
    if (window.selectedCategory !== 'all' && !sortedCats.includes(window.selectedCategory)) {
        window.selectedCategory = 'all';
    }

    grid.innerHTML = '';
    if(!filtered.length) { 
        grid.innerHTML = '<div style="text-align:center; padding:3rem; opacity:0.5; grid-column: 1/-1;">No items found</div>'; 
        return; 
    }

    // Determine which categories to render
    const filteredCats = { };
    filtered.forEach(i => {
        const cat = (i.category || 'General').trim();
        if(!filteredCats[cat]) filteredCats[cat] = [ ];
        filteredCats[cat].push(i);
    });

    let displayCats = sortedCats.filter(c => filteredCats[c] && filteredCats[c].length > 0);

    if (window.selectedCategory !== 'all') {
        const catItems = filteredCats[window.selectedCategory] || [];
        
        // Show category filter header
        const filterHeader = document.createElement('div');
        filterHeader.className = 'category-filter-header';
        filterHeader.innerHTML = `
            <span>Showing <strong>${window.selectedCategory}</strong> (${catItems.length} items)</span>
            <button type="button" class="btn-clear-cat" onclick="selectCategory('all')">
                <i class="fas fa-times"></i> View All
            </button>
        `;
        grid.appendChild(filterHeader);

        if (!catItems.length) {
            const emptyNotice = document.createElement('div');
            emptyNotice.className = 'category-block';
            emptyNotice.innerHTML = `
                <div class="category-title">${window.selectedCategory}</div>
                <div style="text-align:center; padding:2.5rem 1rem; color:var(--text-muted);">
                    <i class="fas fa-search fa-2x" style="opacity:0.3; margin-bottom:12px; display:block;"></i>
                    <p>No items found ${search ? `matching "${search}"` : ''} in ${window.selectedCategory}.</p>
                    <button type="button" class="btn-clear-cat" style="margin-top:10px; border:1px solid var(--primary);" onclick="selectCategory('all')">View All Items</button>
                </div>
            `;
            grid.appendChild(emptyNotice);
            return;
        }

        displayCats = [window.selectedCategory];
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
            // If discount exists
            if(item.discountPercent && new Date(item.discountExpiry) > new Date()) {
                price = (item.price * (1 - item.discountPercent / 100));
            }

            const cartItem = window.cart.find(ci => ci.id === item.id);
            const card = document.createElement('div');
            card.className = 'card reveal active';
            card.style.animation = 'fadeUp 0.6s ease-out backwards';
            card.style.animationDelay = (filtered.indexOf(item) * 0.05) + 's';
            if(isOut) card.style.opacity = '0.6';

            const cleanName = item.name ? item.name.replace(/\s+/g, '') : '';
            const imgUrl = getItemImageUrl(item.name);
            window.imageCache[item.id] = imgUrl;

            card.innerHTML = `
                <div class="img-container">
                    <div class="img-fallback"><i class="fas fa-utensils"></i></div>
                    <img id="img-${item.id}" class="product-img" src="${imgUrl}" alt="${item.name}" loading="lazy" onload="if(this.previousElementSibling) this.previousElementSibling.style.display='none';" onerror="handleImgError(this, '${cleanName.replace(/'/g, "\\'")}')">
                    ${isOut ? '<div class="out-badge">Out of Stock</div>' : ''}
                    ${item.discountPercent && new Date(item.discountExpiry) > new Date() ? `<div class="discount-badge">-${item.discountPercent}%</div>` : ''}
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
                </div>
            `;

            section.querySelector('.product-grid').appendChild(card);
        });
    });
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

// Bind to window for global exposure
window.initApp = initApp;
window.showModal = showModal;
window.hideModal = hideModal;
window.renderItems = renderItems;
window.selectCategory = selectCategory;
window.scrollCategoryNav = scrollCategoryNav;

// Auto-init on load if not deferred
document.addEventListener('DOMContentLoaded', initApp);
