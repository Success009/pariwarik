// Manual Order Builder Logic
const menuRef = commonRefs.menu;
const ordersRef = commonRefs.orders;
const db = firebase.database();

const TABLES = [
  "table 1", "table 2", "table 3", "table 4", 
  "hall 1", "hall 2", "hall 3", 
  "cabin 1", "cabin 2", "cabin 3", "cabin 4", "cabin 5", "cabin 6", "cabin up", 
  "terrace", "top", 
  "room 101", "room 102", "room 103", "room 104", 
  "room 201", "room 202", "room 203"
];

let menuCache = { };
let cart = [ ];
let creditPeople = [ ];
let activeCategory = 'All';
let searchQuery = '';

// Helper to get image URL (same as orders.js)
function getImgUrl(name) {
    const clean = name.replace(/\s+/g, '') + '.jpg';
    return `https://firebasestorage.googleapis.com/v0/b/deep-freehold-389006.appspot.com/o/images%2F${clean}?alt=media`;
}


// 1. Initial Load of Menu and Credit Customers
function init() {
    injectHeader('StaffManualOrder.html');
    populateTableSelector();
    updateFloatingCartCount();
    
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            // Load menu items
            menuRef.on('value', snap => {
                menuCache = { };
                snap.forEach(child => {
                    const item = child.val();
                    // Filter only 'Hotel' items that are in stock
                    if (item.type === 'Hotel' && item.status !== 'out_of_stock') {
                        menuCache[child.key] = { id: child.key, ...item };
                    }
                });
                renderCategoryTabs();
                renderMenuItems();
            });

            // Real-time listener for credit customers (same as orders.js)
            db.ref('credits/people').on('value', snap => {
                creditPeople = [ ];
                if (snap.exists()) {
                    snap.forEach(child => {
                        const p = child.val();
                        p.id = child.key;
                        creditPeople.push(p);
                    });
                }
                updateCreditSelect();
            });
        }
    });
}
  

// 2. Render Category Tabs
function renderCategoryTabs() {
    const tabsContainer = document.getElementById('categoryTabs');
    if (!tabsContainer) return;

    const categories = new Set();
    Object.values(menuCache).forEach(item => {
        if (item.category) categories.add(item.category);
    });

    const sortedCategories = Array.from(categories).sort();
    
    let html = `<button class="cat-tab ${activeCategory === 'All' ? 'active' : ''}" onclick="selectCategory('All')">All Items</button>`;
    sortedCategories.forEach(cat => {
        html += `<button class="cat-tab ${activeCategory === cat ? 'active' : ''}" onclick="selectCategory('${cat.replace(/'/g, "\\'")}')">${cat}</button>`;
    });
    tabsContainer.innerHTML = html;
}

function selectCategory(cat) {
    activeCategory = cat;
    document.querySelectorAll('.cat-tab').forEach(tab => {
        if (tab.textContent === cat || (cat === 'All' && tab.textContent === 'All Items')) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    renderMenuItems();
}

// 3. Render Menu Items Grid
function renderMenuItems() {
    const grid = document.getElementById('itemsGrid');
    if (!grid) return;

    const query = document.getElementById('searchInput').value.toLowerCase();
    const items = Object.values(menuCache).filter(item => {
        const matchesCategory = (activeCategory === 'All' || item.category === activeCategory);
        const matchesSearch = item.name.toLowerCase().includes(query);
        return matchesCategory && matchesSearch;
    });

    if (items.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:3rem; opacity:0.5;"><h3>No items found</h3></div>`;
        return;
    }

    grid.innerHTML = items.map(item => {
        const price = item.price || 0;
        return `
            <div class="item-card" onclick="addToCart('${item.id}')">
                <div class="item-card-img-wrapper">
                    <img class="item-card-img" src="${getImgUrl(item.name)}" onerror="this.onerror=null; this.src='https://placehold.co/120x90?text=${encodeURIComponent(item.name)}';">
                    <span class="item-card-badge">${item.category}</span>
                </div>
                <div class="item-card-info">
                    <div class="item-card-name">${item.name}</div>
                    <div class="item-card-price-row">
                        <div class="item-card-price">Rs ${price.toFixed(2)}</div>
                        <button class="btn-add-item">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

let filterMenuTimeout;
function filterMenu() {
    clearTimeout(filterMenuTimeout);
    filterMenuTimeout = setTimeout(renderMenuItems, 100);
}

// 4. Cart Operations
function addToCart(itemId) {
    const menuItem = menuCache[itemId];
    if (!menuItem) return;

    const existingIndex = cart.findIndex(item => item.id === itemId);
    if (existingIndex > -1) {
        cart[existingIndex].qty += 1;
    } else {
        cart.push({
            id: menuItem.id,
            name: menuItem.name,
            price: menuItem.price || 0,
            qty: 1
        });
    }
    renderCart();
    updateFloatingCartCount();
    showToast(`Added ${menuItem.name} to order`);
}

function updateCartQty(itemId, change) {
    const index = cart.findIndex(item => item.id === itemId);
    if (index === -1) return;

    cart[index].qty += change;
    if (cart[index].qty <= 0) {
        cart.splice(index, 1);
    }
    renderCart();
    updateFloatingCartCount();
}

function clearCart() {
    cart = [ ];
    renderCart();
    updateFloatingCartCount();
}

function getCartTotal() {
    return cart.reduce((total, item) => total + (item.price * item.qty), 0);
}

function renderCart() {
    const list = document.getElementById('cartItemsList');
    const grandTotalText = document.getElementById('grandTotalText');
    if (!list || !grandTotalText) return;

    if (cart.length === 0) {
        list.innerHTML = `
            <div class="cart-empty-state">
                <i class="fas fa-shopping-basket"></i>
                <p>No food items selected yet.</p>
                <small>Click any menu item on the left to add.</small>
            </div>
        `;
        grandTotalText.textContent = 'Rs 0.00';
        return;
    }

    list.innerHTML = cart.map(item => {
        const itemTotal = item.price * item.qty;
        return `
            <li class="cart-item">
                <img class="cart-item-img" src="${getImgUrl(item.name)}" onerror="this.onerror=null; this.src='https://placehold.co/50x50?text=No+Image';">
                <div class="cart-item-details">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">Rs ${item.price.toFixed(2)} × ${item.qty}</div>
                </div>
                <div class="cart-qty-controls">
                    <button class="cart-qty-btn" onclick="updateCartQty('${item.id}', -1)"><i class="fas fa-minus" style="font-size:0.75rem;"></i></button>
                    <span class="cart-qty-val">${item.qty}</span>
                    <button class="cart-qty-btn" onclick="updateCartQty('${item.id}', 1)"><i class="fas fa-plus" style="font-size:0.75rem;"></i></button>
                </div>
            </li>
        `;
    }).join('');

    grandTotalText.textContent = `Rs ${getCartTotal().toFixed(2)}`;
}

// 5. Table Management
function populateTableSelector() {
    const selector = document.getElementById('tableSelector');
    if (!selector) return;

    let html = '<option value="General">General / Walk-in</option>';
    TABLES.forEach(t => {
        // Capitalize each word for display
        const display = t.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        html += `<option value="${t}">${display}</option>`;
    });
    html += '<option value="Custom">Custom Name / Spot...</option>';
    selector.innerHTML = html;
}

function handleTableChange(value) {
    const customInput = document.getElementById('customTableInput');
    if (value === 'Custom') {
        customInput.style.display = 'block';
        customInput.focus();
    } else {
        customInput.style.display = 'none';
        customInput.value = '';
    }
}

function getSelectedTable() {
    const selector = document.getElementById('tableSelector');
    if (selector && selector.value === 'Custom') {
        const val = document.getElementById('customTableInput').value.trim();
        return val || "Table Custom";
    }
    return selector ? selector.value : "General";
}

// Floating Cart Counter for Mobile Layout
function updateFloatingCartCount() {
    const countSpan = document.getElementById('floatingCartCount');
    if (!countSpan) return;

    const count = cart.reduce((total, item) => total + item.qty, 0);
    countSpan.textContent = count;

    const wrapper = document.querySelector('.cart-wrapper');
    const overlay = document.querySelector('.cart-overlay');
    if (count === 0 && wrapper && wrapper.classList.contains('active')) {
        wrapper.classList.remove('active');
        overlay.classList.remove('active');
    }
}

function toggleCartDrawer() {
    const wrapper = document.querySelector('.cart-wrapper');
    const overlay = document.querySelector('.cart-overlay');
    if (wrapper && overlay) {
        wrapper.classList.toggle('active');
        overlay.classList.toggle('active');
    }
}

// 6. Order Submissions
function getOrderPayload(status) {
    const tableName = getSelectedTable();
    // Format customer display name, e.g. "Table 1", "Cabin Up", etc.
    const displayTable = tableName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    return {
        customerName: displayTable,
        orderType: 'local',
        tableNumber: tableName,
        device: 'Manual Entry (Receptionist)',
        items: cart,
        totalPrice: getCartTotal(),
        status: status,
        timestamp: new Date().toISOString()
    };
}


// Option A: Active Order Sent to Kitchen (shows up under active orders/local)
function submitActiveOrder() {
    if (cart.length === 0) {
        showToast('Please add items to order first!', 'warning');
        return;
    }

    const payload = getOrderPayload('Ordered'); // Starts as 'Ordered' so it behaves exactly like a fresh local table order
    const orderId = db.ref().child('orders/local/manual_order').push().key;
    
    db.ref(`orders/local/manual_order/${orderId}`).set(payload)
        .then(() => {
            showToast('Order successfully sent to incoming orders!');
            clearCart();
        })
        .catch(err => {
            console.error(err);
            showToast('Error saving order', 'error');
        });
}
  
// Option B: Complete Direct Order (Paid in Cash, goes straight to totalorders)
function submitCompletedDirectOrder() {
    if (cart.length === 0) {
        showToast('Please add items to order first!', 'warning');
        return;
    }

    const payload = getOrderPayload('Completed');
    payload.paymentType = 'cash';
    payload.completedAt = new Date().toISOString();

    const orderId = db.ref().child('totalorders').push().key;

    db.ref(`totalorders/${orderId}`).set(payload)
        .then(() => {
            showToast('Direct cash order completed & archived!');
            clearCart();
        })
        .catch(err => {
            console.error(err);
            showToast('Error saving completed order', 'error');
        });
}

// Option C: Complete & Add to Credit Customer
let isSubmittingCredit = false;

function updateCreditSelect() {
    const select = document.getElementById('creditPersonSelect');
    if (!select) return;

    if (creditPeople.length === 0) {
        select.innerHTML = '<option value="">-- No Customers Registered --</option>';
        return;
    }

    const sorted = [...creditPeople].sort((a, b) => a.name.localeCompare(b.name));
    select.innerHTML = '<option value="">-- Select Existing Customer --</option>' +
        sorted.map(p => `<option value="${p.id}">${p.name} (Owed: Rs ${p.remainingCredit.toFixed(2)})</option>`).join('');
}

function openCreditModal() {
    if (cart.length === 0) {
        showToast('Please add items to order first!', 'warning');
        return;
    }

    const nameInput = document.getElementById('newPersonName');
    const phoneInput = document.getElementById('newPersonPhone');
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';

    updateCreditSelect();

    const m = document.getElementById('creditModal');
    if (m) {
        m.style.display = 'flex';
        setTimeout(() => m.classList.add('active'), 10);
    }
}

function closeCreditModal() {
    const m = document.getElementById('creditModal');
    if (m) {
        m.classList.remove('active');
        setTimeout(() => m.style.display = 'none', 300);
    }
}

function submitOrderToCredit() {
    if (cart.length === 0) {
        showToast('Order is empty!', 'warning');
        return;
    }

    if (isSubmittingCredit) return;

    const select = document.getElementById('creditPersonSelect');
    const selectedPersonId = select ? select.value : '';
    const newNameInput = document.getElementById('newPersonName');
    const newPhoneInput = document.getElementById('newPersonPhone');
    const newName = newNameInput ? newNameInput.value.trim() : '';
    const newPhone = newPhoneInput ? newPhoneInput.value.trim() : '';

    let personId = selectedPersonId;
    let personName = '';
    const orderTotal = getCartTotal();

    const completeCreditAction = (finalPersonId, finalPersonName) => {
        isSubmittingCredit = true;

        // Step 1: Save addition to credit balance
        db.ref(`credits/people/${finalPersonId}/remainingCredit`).transaction(current => {
            return (current || 0) + orderTotal;
        }, (error, committed) => {
            if (error) {
                console.error(error);
                showToast('Error adding credit balance', 'error');
                isSubmittingCredit = false;
                return;
            }

            if (committed) {
                const orderId = db.ref().child('totalorders').push().key;

                // Step 2: Log ledger transaction
                const tx = {
                    type: 'addition',
                    amount: orderTotal,
                    orderId: orderId,
                    items: cart,
                    timestamp: new Date().toISOString(),
                    note: 'Food order added to credit (Manual)'
                };

                db.ref(`credits/transactions/${finalPersonId}`).push(tx)
                    .then(() => {
                        // Step 3: Archive directly into totalorders as Completed under Credit
                        const payload = getOrderPayload('Completed');
                        payload.paymentType = 'credit';
                        payload.creditPersonId = finalPersonId;
                        payload.completedAt = new Date().toISOString();

                        db.ref(`totalorders/${orderId}`).set(payload).then(() => {
                            showToast(`Order credited to ${finalPersonName}`);
                            clearCart();
                            closeCreditModal();
                            isSubmittingCredit = false;
                        });
                    })
                    .catch(err => {
                        console.error(err);
                        showToast('Error creating credit ledger entry', 'error');
                        isSubmittingCredit = false;
                    });
            } else {
                isSubmittingCredit = false;
            }
        });
    };

    if (newName) {
        // Create new credit profile first
        const newPerson = {
            name: newName,
            phone: newPhone || null,
            remainingCredit: 0,
            createdAt: new Date().toISOString()
        };

        db.ref('credits/people').push(newPerson).then(snap => {
            personId = snap.key;
            completeCreditAction(personId, newName);
        }).catch(err => {
            console.error(err);
            showToast('Error registering customer account', 'error');
        });
    } else if (personId) {
        const personObj = creditPeople.find(p => p.id === personId);
        personName = personObj ? personObj.name : 'Customer';
        completeCreditAction(personId, personName);
    } else {
        showToast('Please select a customer or enter a new customer name', 'warning');
    }
}

// Bind globals for inline HTML event handlers
window.selectCategory = selectCategory;
window.addToCart = addToCart;
window.updateCartQty = updateCartQty;
window.clearCart = clearCart;
window.handleTableChange = handleTableChange;
window.submitActiveOrder = submitActiveOrder;
window.submitCompletedDirectOrder = submitCompletedDirectOrder;
window.openCreditModal = openCreditModal;
window.closeCreditModal = closeCreditModal;
window.submitOrderToCredit = submitOrderToCredit;
window.toggleCartDrawer = toggleCartDrawer;

window.addEventListener('load', init);
