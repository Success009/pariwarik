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

let allItems = [ ], cart = [ ], orderType = 'local';
const imageCache = {};

// Global auth state
let _currentUser = null;

function initApp() {
    closeAll();
    localStorage.setItem('order_type', 'local');
    
    setTimeout(() => {
        const loader = document.getElementById('loader');
        if(loader) loader.style.display = 'none';
    }, 1500);
    
    try {
        if (!firebase.apps.length) firebase.initializeApp(fConfig);
        const auth = firebase.auth();
        const db = firebase.database();

        // Listen for Auth changes and capture the user object immediately
        auth.onAuthStateChanged(user => {
            console.log("Auth State:", user ? "Connected as " + user.uid : "Disconnected");
            _currentUser = user;
            if(!user) {
                auth.signInAnonymously().catch(err => {
                    console.error("Auth Error:", err.code, err.message);
                    if(err.code === 'auth/operation-not-allowed') {
                        showModal("Configuration Required", "Anonymous Sign-in is not enabled in your Firebase Console. Please go to Authentication -> Sign-in Method and enable 'Anonymous'.");
                    } else if(window.location.protocol === 'file:') {
                        showModal("Local File Detected", "Firebase Authentication requires a web server. Please run the 'run_dev.py' script and open http://localhost:8000");
                    }
                });
            }
            startListeners(db);
        });
    } catch (e) {
        console.error("Firebase Initialization Error:", e);
        document.getElementById('loader').style.display='none';
    }
}

function toggleDrawer(id) {
    const dr = document.getElementById(id);
    const ov = document.getElementById('overlay');
    
    if(dr.classList.contains('active')) {
        closeAll();
    } else {
        // Close other drawers but keep overlay active
        document.querySelectorAll('.drawer').forEach(d => d.classList.remove('active'));
        
        ov.classList.add('active');
        dr.classList.add('active');

        // If opening registration, sync data
        if(id === 'regDrawerStep1') {
            const name = localStorage.getItem('order_name');
            if(name) document.getElementById('regName').value = name;
            
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

function startListeners(db) {
    // Fetch all menu items
    db.ref('menu').on('value', snap => {
        allItems = [ ];
        snap.forEach(c => {
            const i = c.val();
            allItems.push({id: c.key, ...i});
        });
        renderItems();
    });
}

function renderItems() {
    const grid = document.getElementById('menuContent');
    if(!grid) return;
    
    const search = document.getElementById('searchInput') ? document.getElementById('searchInput').value.toLowerCase() : '';
    
    // STRICT FILTER: Type must be 'Hotel'
    const filtered = allItems.filter(i => (i.type === 'Hotel') && i.name.toLowerCase().includes(search));
    
    grid.innerHTML = '';
    if(!filtered.length) { 
        grid.innerHTML = '<div style="text-align:center; padding:3rem; opacity:0.5; grid-column: 1/-1;">No items found</div>'; 
        return; 
    }

    const categories = {};
    filtered.forEach(i => { if(!categories[i.category]) categories[i.category] = [ ]; categories[i.category].push(i); });

    Object.keys(categories).sort().forEach(cName => {
        const section = document.createElement('div');
        section.className = 'category-block';
        section.innerHTML = `<div class="category-title">${cName}</div><div class="product-grid"></div>`;
        grid.appendChild(section);

        categories[cName].forEach(item => {
            const isOut = item.status === 'out_of_stock';
            // Simple price logic, ignoring complex grocery profit models if needed, or keeping compatibility
            let price = item.price + (item.profit || 0); 
            // If discount exists
            if(item.discountPercent && new Date(item.discountExpiry) > new Date()) {
                price = (item.price * (1 - item.discountPercent / 100)) + (item.profit || 0);
            }

            const cartItem = cart.find(ci => ci.id === item.id);
            const card = document.createElement('div');
            card.className = 'card reveal active';
            card.style.animation = 'fadeUp 0.6s ease-out backwards';
            card.style.animationDelay = (filtered.indexOf(item) * 0.05) + 's';
            if(isOut) card.style.opacity = '0.6';

            card.innerHTML = `
                <div class="img-container">
                    <div class="img-fallback"><i class="fas fa-utensils"></i></div>
                    <img id="img-${item.id}" src="" style="display:none; transition: opacity 0.4s;">
                </div>
                <div class="card-body">
                    <div class="p-name">${item.name}</div>
                    <div class="p-price">Rs ${price.toFixed(2)}</div>
                    <div class="p-unit">${item.unit ? 'per ' + item.unit : ''}</div>
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

            // Optimized Image Loading with Cache
            const cleanName = item.name.replace(/\s+/g, '') + '.jpg';
            const img = document.getElementById(`img-${item.id}`);
            
            if(imageCache[item.id]) {
                if(img) {
                    img.src = imageCache[item.id];
                    img.style.display = 'block';
                    img.previousElementSibling.style.display = 'none';
                }
            } else {
                firebase.storage().ref('images/' + cleanName).getDownloadURL().then(url => {
                    if(img) {
                        img.src = url;
                        img.style.display = 'block';
                        img.previousElementSibling.style.display = 'none';
                        imageCache[item.id] = url;
                    }
                }).catch(() => {});
            }
        });
    });
}

function addToCart(id) {
    const item = allItems.find(i => i.id === id);
    let p = item.price + (item.profit || 0);
    if(item.discountPercent && new Date(item.discountExpiry) > new Date()) {
        p = (item.price * (1 - item.discountPercent / 100)) + (item.profit || 0);
    }
    
    cart.push({ id, name: item.name, price: p, qty: 1 });
    updateCartUI();
    renderItems();
}

function updateQty(id, dir) {
    const idx = cart.findIndex(c => c.id === id);
    if(idx === -1) return;
    cart[idx].qty += dir;
    if(cart[idx].qty <= 0) cart.splice(idx, 1);
    updateCartUI();
    renderItems();
}

function updateCartUI() {
    let sub = 0;
    const list = document.getElementById('cartList');
    if(!list) return;

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
    
    if(totalEl) totalEl.innerText = sub.toFixed(2);
    if(badge) {
        badge.innerText = cart.length;
        badge.style.display = cart.length ? 'flex' : 'none';
    }
    
    // Update drawer totals
    document.getElementById('cartTotalDrawer').innerText = "Rs " + sub.toFixed(2);
}

// Location logic simplified to manual confirmation for now.

function setOrderType(type) {
    orderType = type;
    localStorage.setItem('order_type', type);
    
    const hotelFields = document.getElementById('hotelFields');
    const localFields = document.getElementById('localFields');
    const btnHotel = document.getElementById('btnHotel');
    const btnLocal = document.getElementById('btnLocal');
    
    if(type === 'hotel') {
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
    if(!cart.length) return;
    
    const name = localStorage.getItem('order_name');
    const phone = localStorage.getItem('local_phone');
    if (!name || !phone) {
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
    const name = document.getElementById('regName').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    if(!name || !phone) {
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
    const name = document.getElementById('regName').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const landmark = document.getElementById('regLandmark').value.trim();

    if(!name || !phone) return showModal("Required Info", "Please enter your name and phone number.");
    if(!landmark) return showModal("Required Info", "Please enter your nearest landmark.");
    
    localStorage.setItem('order_name', name);
    localStorage.setItem('order_type', 'local');
    localStorage.setItem('local_phone', phone);
    localStorage.setItem('local_area', 'Bharatpur 10');
    localStorage.setItem('local_landmark', landmark);

    document.getElementById('confirmMsg').innerText = "Ready to confirm your delivery order?";
    document.getElementById('confirmSubMsg').innerText = "Our delivery partner will bring it to your doorstep.";
    
    toggleDrawer('confirmDrawer');
}

function finalizeOrder() {
    const auth = firebase.auth();
    const user = auth.currentUser;
    
    console.log("Attempting to finalize order. Current user:", user ? user.uid : "None");

    if(!user) {
        showModal("Connection Lost", "Authenticating with server, please wait...", "info");
        auth.signInAnonymously()
            .then((u) => {
                console.log("Re-auth success:", u.user.uid);
                showModal("Connected", "You are now connected. Please click 'Place Order Now' again.", "success");
            })
            .catch(err => {
                console.error("Auth Fail:", err.code, err.message);
                showModal("Connection Error", "Error: " + err.message);
            });
        return;
    }
    
    const type = localStorage.getItem('order_type');
    const order = { 
        customerName: localStorage.getItem('order_name'), 
        orderType: type,
        items: cart, 
        totalPrice: parseFloat(document.getElementById('mainTotal').innerText), 
        status: 'Ordered', 
        timestamp: new Date().toISOString() 
    };

    if(type === 'hotel') {
        order.roomNumber = localStorage.getItem('hotel_room');
    } else {
        order.phone = localStorage.getItem('local_phone');
        order.area = localStorage.getItem('local_area');
        order.landmark = localStorage.getItem('local_landmark');
        order.distance = localStorage.getItem('local_distance');
    }
    
    const path = type === 'hotel' ? `orders/hotel/${user.uid}` : `orders/local/${user.uid}`;
    
    firebase.database().ref(path).push(order).then(() => {
        showModal("Order Successful", "Your order has been sent to our kitchen. We will contact you shortly!", "success"); 
        cart = [ ]; 
        updateCartUI(); 
        renderItems(); 
        closeAll();
    }).catch(e => {
        console.error(e);
        showModal("Order Failed", "Could not place order. Please check your connection and try again.");
    });
}

// Global exposure for HTML onclicks
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
window.setOrderType = setOrderType;

// Initialize
document.addEventListener('DOMContentLoaded', initApp);