// Order Management Logic
const menuRef = commonRefs.menu;
const ordersRef = commonRefs.orders;
const allOrders = { };
const menuCache = { };
const dbMergeScheduled = new Set();

// Helpers
function getImgUrl(name) {
    const clean = name.replace(/\s+/g, '') + '.jpg';
    return `https://firebasestorage.googleapis.com/v0/b/deep-freehold-389006.appspot.com/o/images%2F${clean}?alt=media`;
}

function parseDevice(ua) {
    if (!ua) return "Unknown Device";
    if (ua.includes("iPhone")) return "iPhone";
    if (ua.includes("Android")) return "Android Phone";
    if (ua.includes("Windows")) return "Windows PC";
    if (ua.includes("Macintosh")) return "MacBook/Mac";
    return "Mobile/Tablet";
}


    if (results.length === 0) return "just now";
    return results.join(' ') + " old";
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
    const paths = ['orders/grocery', 'orders/hotel', 'orders/local', 'orders/online'];
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
                    allOrders[id] = {
                        ...orderSnapshot.val(),
                        id: id,
                        type: type,
                        nodeType: type,
                        userUid: userSnapshot.key,
                        dbPath: path + '/' + userSnapshot.key + '/' + id
                    };
                });
            });
            renderAllOrders();
        });
    });
}

// 3. Merging Logic
function scheduleDBMerge(newOrder, parentOrder) {
    const mergeId = `${newOrder.id}_into_${parentOrder.id}`;
    if (dbMergeScheduled.has(mergeId)) return;
    dbMergeScheduled.add(mergeId);

    console.log(`Merge scheduled: ${newOrder.id} -> ${parentOrder.id}`);
    
    setTimeout(() => {
        const db = firebase.database();
        const parentRef = db.ref(parentOrder.dbPath);
        const childRef = db.ref(newOrder.dbPath);

        childRef.once('value').then(snap => {
            if (!snap.exists()) {
                dbMergeScheduled.delete(mergeId);
                return;
            }

            parentRef.transaction((current) => {
                if (current) {
                    if (!current.mergedIds) current.mergedIds = [ ];
                    if (current.mergedIds.includes(newOrder.id)) return;

                    current.mergedIds.push(newOrder.id);
                    // Add timestamp to the divider for DB storage
                    const divider = { isDivider: true, timestamp: newOrder.timestamp };
                    current.items = [ ...newOrder.items, divider, ...current.items ];
                    
                    const newTotal = (parseFloat(current.totalPrice) || 0) + (parseFloat(newOrder.totalPrice) || 0);
                    current.totalPrice = newTotal;
                    
                    return current;
                }
            }, (error, committed) => {
                if (committed) {
                    childRef.remove();
                    console.log(`Merged ${newOrder.id} successfully.`);
                } else {
                    dbMergeScheduled.delete(mergeId);
                }
            });
        });
    }, 1000);
}

// 4. Main Rendering Logic
function renderAllOrders() {
    const orderSection = document.getElementById('orderSection');
    if (!orderSection) return;
    
    const rawOrders = Object.values(allOrders);
    const displayOrders = [ ];
    const mergedChildIds = new Set();
    const parentAugmentations = { };

    rawOrders.forEach(order => {
        if (order.type === 'local' && order.status === 'Ordered' && order.tableNumber) {
            const parent = rawOrders.find(p => 
                p.type === 'local' && 
                p.status === 'Accepted' && 
                p.tableNumber === order.tableNumber
            );
            
            if (parent) {
                mergedChildIds.add(order.id);
                if (!parentAugmentations[parent.id]) {
                    // Store batches with timestamps
                    parentAugmentations[parent.id] = { batches: [ { items: parent.items, timestamp: parent.timestamp } ] };
                }
                // Newer order at the top
                parentAugmentations[parent.id].batches.unshift({ items: order.items, timestamp: order.timestamp });
                scheduleDBMerge(order, parent);
            }
        }
    });

    rawOrders.forEach(order => {
        if (!mergedChildIds.has(order.id)) {
            displayOrders.push(order);
        }
    });

    const presenceCards = Array.from(document.querySelectorAll('.presence-card'));
    orderSection.innerHTML = '';
    presenceCards.forEach(card => orderSection.appendChild(card));

    const sorted = displayOrders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (sorted.length === 0 && presenceCards.length === 0) {
        orderSection.innerHTML = '<div class="empty-state"><h3>No Active Orders Found</h3></div>';
        return;
    }

    sorted.forEach(order => {
        let itemsToRender = order.items || [ ];
        if (parentAugmentations[order.id]) {
            itemsToRender = [ ];
            parentAugmentations[order.id].batches.forEach((batch, idx) => {
                itemsToRender.push(...batch.items);
                if (idx < parentAugmentations[order.id].batches.length - 1) {
                    // Include timestamp in the visual divider
                    itemsToRender.push({ isDivider: true, timestamp: batch.timestamp });
                }
            });
        }

        let total = 0;
        const itemsHTML = itemsToRender.map(i => {
            if (i.isDivider) {
                const timeStr = i.timestamp ? new Date(i.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "New Items";
                return `<li class="item-divider"><span class="divider-label">Added at ${timeStr}</span></li>`;
            }
            
            const price = i.price !== undefined ? i.price : ((menuCache[i.name] || { }).price || 0) / ((menuCache[i.name] || { }).startingValue || 1);
            const qty = i.qty || i.quantity || 1;
            total += price * qty;
            
            return `
            <li style="display:flex; align-items:center; gap:10px;">
                <img src="${getImgUrl(i.name)}" style="width:35px; height:35px; border-radius:4px; object-fit:cover; background:#f0f2f5;" onerror="this.onerror=null; this.src='https://placehold.co/100x100?text=No+Image';">
                <div style="flex:1;">
                    <div style="font-weight:600;">${i.name}</div>
                    <div style="font-size:0.75rem; color:var(--gray);">Rs ${price.toFixed(2)} &times; ${qty}</div>
                </div>
            </li>`;
        }).join('');

        const html = `
            <div class="order-card" id="${order.id}">
                <div class="card-header">
                    <div class="card-title">
                        <span>${order.tableNumber || order.customerName || 'Guest'}</span>
                        <span style="font-size:0.7rem; color:var(--secondary); background:#eee; padding:2px 6px; border-radius:4px;">${order.type.toUpperCase()}</span>
                    </div>
                    <div class="timestamp" data-time="${order.timestamp}">${new Date(order.timestamp).toLocaleString()} <span class="time-ago">(${formatRelativeTime(order.timestamp)})</span></div>
                    <div class="device-id">
                        ${order.device ? `<div><i class="fas fa-mobile-alt"></i> ${parseDevice(order.device)}</div>` : ''}
                        ${order.phone ? `<div><i class="fas fa-phone"></i> ${order.phone}</div>` : ''}
                        ${order.landmark ? `<div><i class="fas fa-map-marker-alt"></i> ${order.landmark}</div>` : ''}
                        ${order.roomNumber ? `<div><i class="fas fa-door-open"></i> Room: ${order.roomNumber}</div>` : ''}
                    </div>
                </div>
                <div class="card-body">
                    <div class="order-items">
                        <h4><i class="fas fa-shopping-basket"></i> Items</h4>
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

function listenToPresence() {
    const orderSection = document.getElementById('orderSection');
    if (!orderSection) return;

    firebase.database().ref('presence/local').on('value', snap => {
        document.querySelectorAll('.presence-card').forEach(el => el.remove());
        if (!snap.exists()) return;

        const now = Date.now();
        snap.forEach(child => {
            const data = child.val();
            if (data.lastSeen && (now - data.lastSeen > 60000)) {
                firebase.database().ref('presence/local').child(child.key).remove();
                return;
            }

            const items = data.cart || [ ];
            let total = 0;
            const itemsHTML = items.map(i => {
                const price = i.price || 0;
                const qty = i.qty || 1;
                total += price * qty;
                return `
                <li style="display:flex; align-items:center; gap:10px;">
                    <img src="${getImgUrl(i.name)}" style="width:35px; height:35px; border-radius:4px; object-fit:cover; background:#f0f2f5;" onerror="this.onerror=null; this.src='https://placehold.co/100x100?text=No+Image';">
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

// 5. Status Update & Archiving
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

// 6. Utility & Modals
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

setInterval(() => {
    document.querySelectorAll('.timestamp').forEach(el => {
        if (!el.dataset.time) return;
        const base = new Date(el.dataset.time).toLocaleString();
        const relative = formatRelativeTime(el.dataset.time);
        const relativeSpan = el.querySelector('.time-ago');
        if (relativeSpan) {
            relativeSpan.textContent = `(${relative})`;
        } else {
            el.innerHTML = `${base} <span class="time-ago">(${relative})</span>`;
        }
    });
}, 1000);

window.addEventListener('load', () => {
    injectHeader('StaffOrder.html');
    fetchOrders();
    listenToPresence();
});