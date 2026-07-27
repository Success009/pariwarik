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
window.imageCache = { };
window._currentUser = null;

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

function _performRenderItems() {
    const grid = document.getElementById('menuContent');
    if(!grid) return;

    const searchInput = document.getElementById('searchInput');
    const search = searchInput ? searchInput.value.toLowerCase() : '';

    // STRICT FILTER: Type must be 'Hotel'
    const filtered = window.allItems.filter(i => (i.type === 'Hotel') && i.name.toLowerCase().includes(search));

    grid.innerHTML = '';
    if(!filtered.length) { 
        grid.innerHTML = '<div style="text-align:center; padding:3rem; opacity:0.5; grid-column: 1/-1;">No items found</div>'; 
        return; 
    }

    const categories = { };
    filtered.forEach(i => { if(!categories[i.category]) categories[i.category] = [ ]; categories[i.category].push(i); });

    const sortedCats = Object.keys(categories).sort((a, b) => {
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

    sortedCats.forEach(cName => {
        const section = document.createElement('div');
        section.className = 'category-block';
        section.innerHTML = `<div class="category-title">${cName}</div><div class="product-grid"></div>`;
        grid.appendChild(section);

        categories[cName].forEach(item => {
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

            card.innerHTML = `
                <div class="img-container">
                    <div class="skeleton"></div>
                    <img class="product-img" style="display:none;" alt="${item.name}">
                    ${isOut ? '<div class="out-badge">Out of Stock</div>' : ''}
                    ${item.discountPercent && new Date(item.discountExpiry) > new Date() ? `<div class="discount-badge">-${item.discountPercent}%</div>` : ''}
                </div>
                <div class="card-body">
                    <div class="card-header">
                        <span class="rarity ${item.rarity ? item.rarity.toLowerCase() : 'basic'}">${item.rarity || 'Basic'}</span>
                    </div>
                    <h3 class="product-title">${item.name}</h3>
                    <div class="product-meta">
                        <span class="price">Rs ${price.toFixed(2)}</span>
                        ${item.unit ? `<span class="unit">per ${item.startingValue || 1} ${item.unit}</span>` : ''}
                    </div>
                    <div class="product-actions">
                        ${isOut ? `
                            <button class="btn btn-secondary" disabled style="width:100%;">Unavailable</button>
                        ` : `
                            <div class="qty-selector" style="${cartItem ? 'display:flex;' : 'display:none;'}">
                                <button class="qty-btn minus" onclick="updateCartQty('${item.id}', -1)">-</button>
                                <span class="qty-val">${cartItem ? cartItem.qty : 1}</span>
                                <button class="qty-btn plus" onclick="updateCartQty('${item.id}', 1)">+</button>
                            </div>
                            <button class="btn btn-primary add-to-cart" onclick="addToCart('${item.id}')" style="${cartItem ? 'display:none;' : 'display:block;'}">
                                <i class="fas fa-plus"></i> Add
                            </button>
                        `}
                    </div>
                </div>
            `;

            section.querySelector('.product-grid').appendChild(card);

            const img = card.querySelector('.product-img');
            const cleanName = item.name.replace(/\s+/g, '') + '.jpg';

            if (window.imageCache[item.id]) {
                if(img) {
                    img.src = window.imageCache[item.id];
                    img.style.display = 'block';
                    img.previousElementSibling.style.display = 'none';
                }
            } else {
                firebase.storage().ref('images/' + cleanName).getDownloadURL().then(url => {
                    if(img) {
                        img.src = url;
                        img.style.display = 'block';
                        img.previousElementSibling.style.display = 'none';
                        window.imageCache[item.id] = url;
                    }
                }).catch(() => {
                    if(img) {
                        img.src = 'https://placehold.co/400x400?text=No+Image';
                        img.style.display = 'block';
                        img.previousElementSibling.style.display = 'none';
                    }
                });
            }
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

// Auto-init on load if not deferred
document.addEventListener('DOMContentLoaded', initApp);
