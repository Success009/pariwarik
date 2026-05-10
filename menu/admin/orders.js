// Order Management Logic
const menuRef = commonRefs.menu;
const ordersRef = commonRefs.orders;
const allOrders = { };
const menuCache = { };
const announcedOrders = new Set();
let initialLoadMap = {
    grocery: true,
    hotel: true,
    online: true,
    local: true
};

function announceOrder(order) {
    if (announcedOrders.has(order.id)) return;
    announcedOrders.add(order.id);

    let location = order.customerName || "a customer";
    if (order.table) {
        location = `table ${order.table}`;
    } else if (order.roomNumber) {
        location = `room ${order.roomNumber}`;
    } else if (order.landmark) {
        location = order.landmark;
    }

    const msg = `New order from ${location}`;
    const utterance = new SpeechSynthesisUtterance(msg);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
}

// 1. Initial Menu Cache load
menuRef.on('value', snap => {
    snap.forEach(child => {
        const item = child.val();
        menuCache[item.name] = item;
    });
    renderAllOrders();
});

// 2. Main Order Fetching
function fetchOrders() {
    const paths = ['orders/grocery', 'orders/hotel', 'orders/online', 'orders/local'];
    paths.forEach(path => {
        firebase.database().ref(path).on('value', (snapshot) => {
            const type = path.split('/')[1];
            // Cleanup existing for this node to handle deletions
            Object.keys(allOrders).forEach(id => {
                if (allOrders[id].nodeType === type) delete allOrders[id];
            });

            snapshot.forEach(userSnapshot => {
                userSnapshot.forEach(orderSnapshot => {
                    const id = orderSnapshot.key;
                    const orderData = {
                        ...orderSnapshot.val(),
                        id: id,
                        type: type,
                        nodeType: type,
                        userUid: userSnapshot.key,
                        dbPath: path + '/' + userSnapshot.key + '/' + id
                    };
                    
                    allOrders[id] = orderData;

                    // Announce if not initial load and it's a new "Ordered" status
                    if (!initialLoadMap[type] && orderData.status === 'Ordered') {
                        announceOrder(orderData);
                    } else {
                        // Mark as announced so we don't speak old orders on refresh
                        announcedOrders.add(id);
                    }
                });
            });
            initialLoadMap[type] = false;
            renderAllOrders();
        });
    });
}

// 3. Main Rendering Logic
function getImgUrl(name) {
    const clean = name.replace(/\s+/g, '') + '.jpg';
    return `https://firebasestorage.googleapis.com/v0/b/deep-freehold-389006.appspot.com/o/images%2F${clean}?alt=media`;
}

function renderAllOrders() {
    const orderSection = document.getElementById('orderSection');
    if (!orderSection) return;
    
    orderSection.innerHTML = '';
    const sorted = Object.values(allOrders).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (sorted.length === 0) {
        orderSection.innerHTML = '<div class="empty-state"><h3>No Active Orders Found</h3></div>';
        return;
    }

    sorted.forEach(order => {
        const items = order.items || [ ];
        let total = 0;

        const itemsHTML = items.map(i => {
            const pricePerUnit = i.price !== undefined ? i.price : ((menuCache[i.name] || { }).price || 0) / ((menuCache[i.name] || { }).startingValue || 1);
            const qty = i.qty || i.quantity || 1;
            total += pricePerUnit * qty;
            return `
            <li style="display:flex; align-items:center; gap:10px;">
                <img src="${getImgUrl(i.name)}" style="width:35px; height:35px; border-radius:4px; object-fit:cover; background:#f0f2f5;" onerror="this.src='https://via.placeholder.com/35?text=%3F'">
                <div style="flex:1;">
                    <div style="font-weight:600;">${i.name}</div>
                    <div style="font-size:0.75rem; color:var(--gray);">Rs ${pricePerUnit.toFixed(2)} &times; ${qty}</div>
                </div>
            </li>`;
        }).join('');

        const html = `
            <div class="order-card" id="${order.id}">
                <div class="card-header">
                    <div class="card-title">
                        <span>${order.customerName || 'Guest'}</span>
                        <span style="font-size:0.65rem; color:var(--secondary); background:#eee; padding:2px 6px; border-radius:4px;">${order.type.toUpperCase()} ORDER</span>
                    </div>
                    <div class="timestamp" data-time="${order.timestamp}">${new Date(order.timestamp).toLocaleString()}</div>
                    <div class="device-id">
                        ${order.device ? `<div style="color:#7f8c8d;"><i class="fas fa-mobile-alt"></i> ${parseDevice(order.device)}</div>` : ''}
                        ${order.phone ? `<div><i class="fas fa-phone"></i> ${order.phone}</div>` : ''}
                        ${order.landmark ? `<div><i class="fas fa-map-marker-alt"></i> ${order.landmark}</div>` : ''}
                        ${order.roomNumber ? `<div><i class="fas fa-door-open"></i> Room: ${order.roomNumber}</div>` : ''}
                    </div>
                </div>
                <div class="card-body">
                    <div class="order-items">
                        <ul class="item-list">${itemsHTML}</ul>
                    </div>
                    <div class="price-info">
                        <div class="price-row total-price">
                            <span>Total Price:</span>
                            <span>Rs ${total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                <div class="card-footer">
                    ${order.status === 'Ordered' ? 
                        `<button class="btn btn-primary" onclick="updateOrderStatus('${order.type}', '${order.userUid}', '${order.id}', 'Accepted')"><i class="fas fa-check"></i> Accept</button>` : 
                        `<button class="btn btn-success" onclick="updateOrderStatus('${order.type}', '${order.userUid}', '${order.id}', 'Completed')"><i class="fas fa-flag-checkered"></i> Complete</button>`
                    }
                    <button class="btn btn-danger" onclick="updateOrderStatus('${order.type}', '${order.userUid}', '${order.id}', 'Cancelled')"><i class="fas fa-times-circle"></i> Cancel</button>
                </div>
            </div>`;
        orderSection.insertAdjacentHTML('beforeend', html);
    });
}

// 4. Status Update & Archiving
function updateOrderStatus(type, userUid, orderId, newStatus) {
    const path = `orders/${type}/${userUid}/${orderId}`;
    let icon = 'fa-question-circle';
    if (newStatus === 'Accepted') icon = 'fa-check-circle';
    if (newStatus === 'Completed') icon = 'fa-flag-checkered';
    if (newStatus === 'Cancelled') icon = 'fa-times-circle';

    showModal('Confirm', `Mark as ${newStatus}?`, icon, [
        { text: 'Confirm', class: 'modal-btn-confirm', onClick: `performUpdate('${path}', '${orderId}', '${newStatus}')` },
        { text: 'Back', class: 'modal-btn-cancel', onClick: 'hideModal()' }
    ]);
}
    

function performUpdate(path, id, status) {
    // Optimistic UI
    const el = document.getElementById(id);
    if (el && (status === 'Completed' || status === 'Cancelled')) {
        el.style.opacity = '0.3';
        el.style.pointerEvents = 'none';
    }
    hideModal();

    firebase.database().ref(path).update({ status: status }).then(() => {
        if (status === 'Completed' || status === 'Cancelled') {
            const db = firebase.database();
            db.ref(path).once('value', s => {
                if (s.exists()) {
                    const d = s.val();
                    const target = status === 'Completed' ? 'totalorders' : 'cancelled_orders';
                    d[status === 'Completed' ? 'completedAt' : 'cancelledAt'] = new Date().toISOString();
                    db.ref(target).child(id).set(d).then(() => db.ref(path).remove());
                }
            });
        }
    }).catch(e => console.error(e));
}

// 5. Utility & Modals
function showModal(title, msg, icon, actions) {
    const m = document.getElementById('customModal');
    m.querySelector('.modal-icon').className = 'modal-icon fas ' + icon;
    m.querySelector('.modal-title').textContent = title;
    m.querySelector('.modal-message').textContent = msg;
    m.querySelector('.modal-actions').innerHTML = actions.map(a => `<button class="modal-btn ${a.class}" onclick="${a.onClick}">${a.text}</button>`).join('');
    m.style.display = 'flex';
    setTimeout(() => m.classList.add('active'), 10);
}

function hideModal() {
    const m = document.getElementById('customModal');
    if(m) {
        m.classList.remove('active');
        setTimeout(() => m.style.display = 'none', 300);
    }
}

// Auto-update timestamps every minute
setInterval(() => {
    const now = Date.now();
    document.querySelectorAll('.timestamp').forEach(el => {
        const t = new Date(el.dataset.time).getTime();
        const m = Math.floor((now - t) / 60000);
        el.innerHTML = `${new Date(t).toLocaleString()} <span style="color:#6c757d">(${m}m ago)</span>`;
    });
}, 60000);

function parseDevice(ua) {
    if (!ua) return "Unknown Device";
    if (ua.includes("iPhone")) return "iPhone";
    if (ua.includes("Android")) return "Android Phone";
    if (ua.includes("Windows")) return "Windows PC";
    if (ua.includes("Macintosh")) return "MacBook/Mac";
    return "Mobile/Tablet";
}

function listenToPresence() {
    const orderSection = document.getElementById('orderSection');
    if (!orderSection) return;

    firebase.database().ref('presence/local').on('value', snap => {
        document.querySelectorAll('.presence-card').forEach(el => el.remove());
        if (!snap.exists()) return;

        const now = Date.now();
        snap.forEach(child => {
            const data = child.val();
            
            // 1. Database Cleanup: Delete sessions older than 1 minute
            if (data.lastSeen && (now - data.lastSeen > 60000)) {
                firebase.database().ref('presence/local').child(child.key).remove();
                return;
            }

            const items = data.cart || [ ];
            let total = 0;

            const itemsHTML = items.map(i => {
                // Presence data includes price already synced from local/menu.js
                const price = i.price || 0;
                const qty = i.qty || 1;
                total += price * qty;
                return `
                <li style="display:flex; align-items:center; gap:10px;">
                    <img src="${getImgUrl(i.name)}" style="width:35px; height:35px; border-radius:4px; object-fit:cover; background:#f0f2f5;" onerror="this.src='https://via.placeholder.com/35?text=%3F'">
                    <div style="flex:1;">
                        <div style="font-weight:600;">${i.name}</div>
                        <div style="font-size:0.75rem; color:var(--gray);">Rs ${price.toFixed(2)} &times; ${qty}</div>
                    </div>
                </li>`;
            }).join('');
            
            const html = `
                <div class="order-card presence-card" style="border-left: 5px solid #ff9f43; background: #fffaf5;">
                    <div class="card-header" style="background: none;">
                        <div class="card-title" style="color: #d35400;">
                            <span>Table ${data.table} (Browsing)</span>
                            <span style="font-size:0.65rem; color:white; background:#ff9f43; padding:2px 6px; border-radius:4px; margin-left:10px;">LIVE PREVIEW</span>
                        </div>
                        <div class="timestamp" style="color: #e67e22;">Active using ${parseDevice(data.device)}</div>
                    </div>
                    <div class="card-body">
                        <div class="order-items">
                            <ul class="item-list">${itemsHTML || '<li style="color:var(--gray); font-style:italic; border:none;">No items in cart yet...</li>'}</ul>
                        </div>
                        ${items.length > 0 ? `
                        <div class="price-info">
                            <div class="price-row total-price" style="color:#d35400;">
                                <span>Draft Total:</span>
                                <span>Rs ${total.toFixed(2)}</span>
                            </div>
                        </div>` : ''}
                    </div>
                </div>`;
            orderSection.insertAdjacentHTML('afterbegin', html);
        });
    });
}

window.addEventListener('load', () => {
    injectHeader('StaffOrder.html');
    fetchOrders();
    listenToPresence();
});