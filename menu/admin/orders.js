// Order Management Logic
const menuRef = commonRefs.menu;
const ordersRef = commonRefs.orders;
const allOrders = { };
const menuCache = { };
const dbMergeScheduled = new Set();

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
    const paths = ['orders/grocery', 'orders/hotel', 'orders/local'];
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

        // Ensure child still exists before merging
        childRef.once('value').then(snap => {
            if (!snap.exists()) {
                dbMergeScheduled.delete(mergeId);
                return;
            }

            parentRef.transaction((current) => {
                if (current) {
                    if (!current.mergedIds) current.mergedIds = [ ];
                    if (current.mergedIds.includes(newOrder.id)) return; // Already merged

                    current.mergedIds.push(newOrder.id);
                    
                    // Prepend new items and a divider to keep older items at the bottom
                    const divider = { isDivider: true };
                    current.items = [ ...newOrder.items, divider, ...current.items ];
                    
                    // Update total price
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

    // Pass 1: Handle Merges for Local Orders
    rawOrders.forEach(order => {
        if (order.type === 'local' && order.status === 'Ordered' && order.tableNumber) {
            const parent = rawOrders.find(p => 
                p.type === 'local' && 
                p.status === 'Accepted' && 
                p.userUid === order.userUid && 
                p.tableNumber === order.tableNumber
            );
            
            if (parent) {
                mergedChildIds.add(order.id);
                if (!parentAugmentations[parent.id]) {
                    parentAugmentations[parent.id] = { batches: [ parent.items ] };
                }
                // Newer order at the top
                parentAugmentations[parent.id].batches.unshift(order.items);
                scheduleDBMerge(order, parent);
            }
        }
    });

    // Pass 2: Filter display list
    rawOrders.forEach(order => {
        if (!mergedChildIds.has(order.id)) {
            displayOrders.push(order);
        }
    });

    orderSection.innerHTML = '';
    const sorted = displayOrders.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (sorted.length === 0) {
        orderSection.innerHTML = '<div class="empty-state"><h3>No Active Orders Found</h3></div>';
        return;
    }

    sorted.forEach(order => {
        let itemsToRender = order.items || [ ];
        
        // Use augmented batches if visually merging
        if (parentAugmentations[order.id]) {
            itemsToRender = [ ];
            parentAugmentations[order.id].batches.forEach((batch, idx) => {
                itemsToRender.push(...batch);
                if (idx < parentAugmentations[order.id].batches.length - 1) {
                    itemsToRender.push({ isDivider: true });
                }
            });
        }

        let total = 0;
        const itemsHTML = itemsToRender.map(i => {
            if (i.isDivider) {
                return '<li class="item-divider"></li>';
            }
            const pricePerUnit = i.price !== undefined ? i.price : ((menuCache[i.name] || { }).price || 0) / ((menuCache[i.name] || { }).startingValue || 1);
            const qty = i.qty || i.quantity || 1;
            total += pricePerUnit * qty;
            return `<li>${i.name} - Rs ${pricePerUnit.toFixed(2)} &times; ${qty}</li>`;
        }).join('');

        const html = `
            <div class="order-card" id="${order.id}">
                <div class="card-header">
                    <div class="card-title">
                        <span>${order.customerName || 'Guest'}</span>
                        <span style="font-size:0.7rem; color:var(--secondary); background:#eee; padding:2px 6px; border-radius:4px;">${order.type.toUpperCase()}</span>
                    </div>
                    <div class="timestamp" data-time="${order.timestamp}">${new Date(order.timestamp).toLocaleString()}</div>
                    <div class="device-id">
                        ${order.phone ? `<div><i class="fas fa-phone"></i> ${order.phone}</div>` : ''}
                        ${order.landmark ? `<div><i class="fas fa-map-marker-alt"></i> ${order.landmark}</div>` : ''}
                        ${order.roomNumber ? `<div><i class="fas fa-door-open"></i> Room: ${order.roomNumber}</div>` : ''}
                        ${order.tableNumber ? `<div><i class="fas fa-utensils"></i> Table: ${order.tableNumber}</div>` : ''}
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
    const now = Date.now();
    document.querySelectorAll('.timestamp').forEach(el => {
        const t = new Date(el.dataset.time).getTime();
        const m = Math.floor((now - t) / 60000);
        el.innerHTML = `${new Date(t).toLocaleString()} <span style="color:#6c757d">(${m}m ago)</span>`;
    });
}, 60000);

window.addEventListener('load', () => {
    injectHeader('StaffOrder.html');
    fetchOrders();
});