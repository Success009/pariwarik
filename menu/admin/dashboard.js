// Dashboard Logic
let allOrders = [ ], allCancelled = [ ], allImports = [ ], allPeople = [ ], filteredItems = [ ];
let currentView = 'sales';
let usageMap = { }; 
let menuCache = { };

const totalOrdersRef = commonRefs.totalOrders;
const cancelledOrdersRef = commonRefs.cancelledOrders;
const importItemsRef = commonRefs.importItems;
const usageRef = commonRefs.usageRecords;
const menuRef = commonRefs.menu;
const creditsPeopleRef = commonRefs.creditsPeople;
const creditsTransactionsRef = commonRefs.creditsTransactions;

const fetchAllData = async () => {
    const [menuSnapshot, ordersSnapshot, importsSnapshot, usageSnapshot, cancelledSnapshot, creditsSnapshot, transactionsSnapshot] = await Promise.all([
        menuRef.once('value'),
        totalOrdersRef.limitToLast(500).once('value'),
        importItemsRef.limitToLast(500).once('value'),
        usageRef.limitToLast(500).once('value'),
        cancelledOrdersRef.limitToLast(100).once('value'),
        creditsPeopleRef.once('value'),
        creditsTransactionsRef.once('value')
    ]);
    // Load Menu Cache first
    menuCache = { };
    menuSnapshot.forEach(child => {
        const item = child.val();
        menuCache[item.name] = { price: item.price || 0, startingValue: item.startingValue || 1 };
    });

    // Helper to evaluate if a timestamp occurred on the current calendar day
    const isToday = (dateString) => {
        if (!dateString) return false;
        const date = new Date(dateString);
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    // Process Cancelled Orders
    allCancelled = [ ];
    if (cancelledSnapshot.exists()) {
        cancelledSnapshot.forEach(child => {
            const order = child.val();
            order.id = child.key;
            let orderTotal = 0;
            if (order.items) {
                order.items.forEach(item => {
                    if (item.isDivider) return;
                    const meta = menuCache[item.name] || { };
                    const pricePerUnit = item.price !== undefined ? item.price : (meta.price || 0) / (meta.startingValue || 1);
                    const qty = item.qty || item.quantity || 1;
                    orderTotal += pricePerUnit * qty;
                });
            }
            order.calculatedTotal = orderTotal;
            allCancelled.push(order);
        });
    }
    document.getElementById('cancelledCount').textContent = allCancelled.length + " Orders";

    // Process Sales (Completed Orders)
    let totalRevenue = 0;
    let todayRevenue = 0; // Tracks revenue created strictly on the current calendar day
    let totalDiscounts = 0; // Cumulative tracker of total flat discounts given to customers
    allOrders = [ ];
    if (ordersSnapshot.exists()) {
        ordersSnapshot.forEach(child => {
            const order = child.val();
            order.id = child.key;
            let orderTotal = 0;
            if (order.items) {
                order.items.forEach(item => {
                    if (item.isDivider) return;
                    const meta = menuCache[item.name] || { };
                    const pricePerUnit = item.price !== undefined ? item.price : (meta.price || 0) / (meta.startingValue || 1);
                    const qty = item.qty || item.quantity || 1;
                    orderTotal += pricePerUnit * qty;
                });
            }
            // Subtract flat discount to obtain the actual realized cash revenue
            const discount = order.discount || 0;
            order.calculatedTotal = orderTotal - discount;
            allOrders.push(order);
            totalDiscounts += discount;

            // Credits should not be counted as a profit/revenue until paid
            const isCreditOrder = order.paymentType === 'credit';
            if (!isCreditOrder) {
                totalRevenue += order.calculatedTotal;
            }

            // Track completed non-credit sales that occurred today
            const orderDate = order.completedAt || order.timestamp;
            if (isToday(orderDate) && !isCreditOrder) {
                todayRevenue += order.calculatedTotal;
            }
        });
    }
    
    // Process Inventory
    const importsMap = new Map();
    let totalImportValue = 0;
    allImports = [ ];
    importsSnapshot.forEach(child => {
        const item = child.val();
        item.id = child.key;
        allImports.push(item);
        importsMap.set(item.id, item);
        totalImportValue += item.price;
    });

    usageMap = { };
    usageSnapshot.forEach(child => {
        const usage = child.val();
        if (!usageMap[usage.importKey]) usageMap[usage.importKey] = 0;
        usageMap[usage.importKey] += usage.quantityUsed;
    });
    
    let costOfUsed = 0;
    let todayCostOfUsed = 0; // Accumulates cost of raw goods consumed today
    for (const [importKey, quantityUsed] of Object.entries(usageMap)) {
        const importItem = importsMap.get(importKey);
        if (importItem) {
            const pricePerUnit = importItem.price / importItem.quantity;
            costOfUsed += pricePerUnit * quantityUsed;
        }
    }

    // Isolate inventory usages that took place today specifically
    usageSnapshot.forEach(child => {
        const usage = child.val();
        if (isToday(usage.createdAt)) {
            const importItem = importsMap.get(usage.importKey);
            if (importItem) {
                const pricePerUnit = importItem.price / importItem.quantity;
                todayCostOfUsed += pricePerUnit * (usage.quantityUsed || 0);
            }
        }
    });
    
    const inventoryValue = totalImportValue - costOfUsed;

    // Process Credits Snapshot
    allPeople = [ ];
    let totalRemainingCredits = 0;
    if (creditsSnapshot && creditsSnapshot.exists()) {
        creditsSnapshot.forEach(child => {
            const person = child.val();
            person.id = child.key;
            allPeople.push(person);
            totalRemainingCredits += (person.remainingCredit || 0);
        });
    }

    // Process Credit Transactions to evaluate cash flow strictly for all-time and the current day
    let totalCreditPayments = 0;
    let todayCreditPayments = 0;
    if (transactionsSnapshot && transactionsSnapshot.exists()) {
        transactionsSnapshot.forEach(personChild => {
            personChild.forEach(txChild => {
                const tx = txChild.val();
                if (tx.type === 'payment') {
                    const paymentAmount = tx.amount || 0;
                    totalCreditPayments += paymentAmount;
                    if (isToday(tx.timestamp)) {
                        todayCreditPayments += paymentAmount;
                    }
                }
            });
        });
    }

    // Add settled credit payments to total and today's revenues (Credits only count towards revenue/profit once paid)
    totalRevenue += totalCreditPayments;
    todayRevenue += todayCreditPayments;

    // Net profit is strictly calculated using realized cash revenue (Cash Sales + Credit Payments - Cost of Goods)
    const netProfit = totalRevenue - costOfUsed;

    // Today's Realized Profit = Today's Realized Cash Revenue - Today's Cost of Raw Goods
    const todayProfit = todayRevenue - todayCostOfUsed;

    updateStats({ totalRevenue, costOfUsed, inventoryValue, totalRemainingCredits, netProfit, totalDiscounts, todayProfit });
    applyFilters();
};

const updateStats = (stats) => {
    document.getElementById('totalRevenue').textContent = "Rs " + stats.totalRevenue.toFixed(2);
    document.getElementById('costOfUsed').textContent = "Rs " + stats.costOfUsed.toFixed(2);
    document.getElementById('inventoryValue').textContent = "Rs " + stats.inventoryValue.toFixed(2);

    const remCreditsEl = document.getElementById('remainingCredits');
    if (remCreditsEl) remCreditsEl.textContent = "Rs " + stats.totalRemainingCredits.toFixed(2);

    const netProfitEl = document.getElementById('netProfit');
    if (netProfitEl) netProfitEl.textContent = "Rs " + stats.netProfit.toFixed(2);

    // Updates Today's profit metric card on the dashboard view
    const todayProfitEl = document.getElementById('todayProfit');
    if (todayProfitEl) todayProfitEl.textContent = "Rs " + stats.todayProfit.toFixed(2);

    // Updates the cumulative discount tracker element on the Dashboard
    const totalDiscountsEl = document.getElementById('totalDiscounts');
    if (totalDiscountsEl) totalDiscountsEl.textContent = "Rs " + stats.totalDiscounts.toFixed(2);
};

const applyFilters = () => {
    const searchTerm = document.getElementById('searchBox').value.toLowerCase();
    const timeFilter = document.getElementById('timeFilter').value;
    const sortOrder = document.getElementById('sortOrder').value;
    
    let sourceData = [ ];
    let timestampField = 'timestamp';
    let amountField = 'calculatedTotal';

    if (currentView === 'sales') {
        sourceData = allOrders;
    } else if (currentView === 'cancelled') {
        sourceData = allCancelled;
        timestampField = 'cancelledAt' || 'timestamp';
    } else if (currentView === 'imports') {
        sourceData = allImports;
        timestampField = 'createdAt';
        amountField = 'price';
    } else if (currentView === 'credits') {
        sourceData = allPeople;
        timestampField = 'createdAt';
        amountField = 'remainingCredit';
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today); 
    thisWeek.setDate(today.getDate() - today.getDay());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    filteredItems = sourceData.filter(item => {
        const itemDate = new Date(item[timestampField]);
        let matchesTime = true;
        
        if (currentView !== 'credits') {
            if (timeFilter === 'today') matchesTime = itemDate >= today;
            else if (timeFilter === 'week') matchesTime = itemDate >= thisWeek;
            else if (timeFilter === 'month') matchesTime = itemDate >= thisMonth;
        }
        
        let matchesSearch = !searchTerm || (
            currentView === 'credits'
            ? (item.name && item.name.toLowerCase().includes(searchTerm)) || (item.phone && item.phone.toLowerCase().includes(searchTerm))
            : (currentView === 'sales'
                ? item.id.toLowerCase().includes(searchTerm) || (item.items && item.items.some(i => i.name && i.name.toLowerCase().includes(searchTerm)))
                : (item.name && item.name.toLowerCase().includes(searchTerm)) || (item.type && item.type.toLowerCase().includes(searchTerm)))
        );
        
        return matchesTime && matchesSearch;
    });

    filteredItems.sort((a, b) => {
        const valA = a[timestampField];
        const valB = b[timestampField];
        if (sortOrder === 'newest') return new Date(valB) - new Date(valA);
        if (sortOrder === 'oldest') return new Date(valA) - new Date(valB);
        if (sortOrder === 'highest') return b[amountField] - a[amountField];
        if (sortOrder === 'lowest') return a[amountField] - b[amountField];
        return 0;
    });
    renderContent();
};

const renderContent = () => {
    const container = document.getElementById('dataContainer');
    if (filteredItems.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-filter"></i><h3>No Items Found</h3><p>Try changing your filters or view.</p></div>';
        return;
    }

    let html = '';
    filteredItems.forEach(item => {
        if (currentView === 'sales') html += createSaleCard(item);
        else if (currentView === 'cancelled') html += createCancelledCard(item);
        else if (currentView === 'imports') html += createImportCard(item);
        else if (currentView === 'credits') html += createCreditCard(item);
    });
    container.innerHTML = html;
};

const createCancelledCard = (order) => {
    const orderItems = (order.items || [ ]).map(item => {
        if (item.isDivider) {
             const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "New Batch";
             return `<li class="item-divider"><span class="divider-label">Added at ${timeStr}</span></li>`;
        }
        return '<li><span>' + item.name + '</span><span>&times; ' + (item.qty || item.quantity || 1) + '</span></li>';
    }).join('');
    const location = order.tableNumber || order.landmark || order.roomNumber || ("Order #" + order.id.slice(-6));
    const timestamp = order.cancelledAt || order.timestamp;
    return `
        <div class="data-card">
            <div class="card-header cancelled">
                <div class="card-title">
                    <span>${location}</span>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <button class="delete-btn" onclick="confirmDeleteOrder('${order.id}', 'cancelled')" title="Delete Cancelled Order" style="background: none; border: none; color: var(--danger); cursor: pointer; padding: 2px 6px; font-size: 1rem; opacity: 0.7; transition: opacity 0.2s, transform 0.2s;" onmouseover="this.style.opacity='1'; this.style.transform='scale(1.15)';" onmouseout="this.style.opacity='0.7'; this.style.transform='scale(1)';">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        <i class="fas fa-ban"></i>
                    </div>
                </div>
                <div class="timestamp" data-time="${timestamp}">
                    Cancelled: ${new Date(timestamp).toLocaleString()} <span class="time-ago">(${formatRelativeTime(timestamp)})</span>
                </div>
            </div>
            <div class="card-body">
                <ul class="item-list">${orderItems || '<li>No items in this order</li>'}</ul>
                <div class="price-info"><div class="total-price cancelled"><span>Lost Value:</span><span>Rs ${order.calculatedTotal.toFixed(2)}</span></div></div>
            </div>
        </div>`;
};

const createSaleCard = (order) => {
    const orderItems = (order.items || [ ]).map(item => {
        if (item.isDivider) {
             const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "New Batch";
             return `<li class="item-divider"><span class="divider-label">Added at ${timeStr}</span></li>`;
        }
        return '<li><span>' + item.name + '</span><span>× ' + (item.qty || item.quantity || 1) + '</span></li>';
    }).join('');
    const location = order.tableNumber || order.landmark || order.roomNumber || ("Order #" + order.id.slice(-6));
    
    // Compute original subtotal to show breakdown alongside applied discount
    const discount = order.discount || 0;
    const subtotal = order.calculatedTotal + discount;

    return `
        <div class="data-card">
            <div class="card-header sales">
                <div class="card-title">
                    <span>${location}</span>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <button class="delete-btn" onclick="confirmDeleteOrder('${order.id}', 'sales')" title="Delete Completed Order" style="background: none; border: none; color: var(--danger); cursor: pointer; padding: 2px 6px; font-size: 1rem; opacity: 0.7; transition: opacity 0.2s, transform 0.2s;" onmouseover="this.style.opacity='1'; this.style.transform='scale(1.15)';" onmouseout="this.style.opacity='0.7'; this.style.transform='scale(1)';">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        <i class="fas fa-receipt"></i>
                    </div>
                </div>
                <div class="timestamp" data-time="${order.timestamp}">
                    ${new Date(order.timestamp).toLocaleString()} <span class="time-ago">(${formatRelativeTime(order.timestamp)})</span>
                </div>
            </div>
            <div class="card-body">
                <ul class="item-list">${orderItems || '<li>No items in this order</li>'}</ul>
                <div class="price-info">
                    ${discount > 0 ? `
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:var(--gray); margin-bottom:5px;">
                            <span>Subtotal:</span>
                            <span>Rs ${subtotal.toFixed(2)}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:var(--danger); margin-bottom:5px; font-weight:600;">
                            <span>Discount:</span>
                            <span>- Rs ${discount.toFixed(2)}</span>
                        </div>
                    ` : ''}
                    <div class="total-price sales">
                        <span>Total Sale:</span>
                        <span>Rs ${order.calculatedTotal.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        </div>`;
};

const createImportCard = (item) => {
    const totalUsed = usageMap[item.id] || 0;
    const remaining = item.quantity - totalUsed;
    return `
        <div class="data-card">
            <div class="card-header imports"><div class="card-title"><span>${item.name}</span><i class="fas fa-boxes"></i></div><div class="timestamp">${new Date(item.createdAt).toLocaleString()}</div></div>
            <div class="card-body">
                <ul class="item-list">
                    <li><span>Imported:</span><strong>${item.quantity} ${item.unit}</strong></li>
                    <li><span>Used:</span><strong>${totalUsed.toFixed(1)} ${item.unit}</strong></li>
                    <li><span>Remaining:</span><strong>${remaining.toFixed(1)} ${item.unit}</strong></li>
                </ul>
                <div class="price-info"><div class="total-price imports"><span>Import Cost:</span><span>Rs ${item.price.toFixed(2)}</span></div></div>
            </div>
        </div>`;
};

const setView = (view) => {
    currentView = view;
    document.getElementById('viewSalesBtn').classList.toggle('active', view === 'sales');
    document.getElementById('viewCancelledBtn').classList.toggle('active', view === 'cancelled');
    document.getElementById('viewImportsBtn').classList.toggle('active', view === 'imports');
    
    const creditsBtn = document.getElementById('viewCreditsBtn');
    if (creditsBtn) creditsBtn.classList.toggle('active', view === 'credits');
    
    let placeholder = 'Search sales...';
    if (view === 'cancelled') placeholder = 'Search cancelled orders...';
    else if (view === 'imports') placeholder = 'Search inventory...';
    else if (view === 'credits') placeholder = 'Search customer accounts...';
    
    document.getElementById('searchBox').placeholder = placeholder;
    
    const clearBtn = document.getElementById('clearCancelledBtn');
    if (clearBtn) {
        clearBtn.style.display = view === 'cancelled' ? 'inline-block' : 'none';
    }
    
    applyFilters();
};

const createCreditCard = (person) => {
    const balance = person.remainingCredit !== undefined ? person.remainingCredit : 0;
    return `
        <div class="data-card">
            <div class="card-header" style="background-color: rgba(142, 68, 173, 0.05); color: #8e44ad;">
                <div class="card-title"><span>${person.name}</span><i class="fas fa-credit-card"></i></div>
                <div class="timestamp">
                    Registered: ${new Date(person.createdAt).toLocaleString()}
                </div>
            </div>
            <div class="card-body">
                <ul class="item-list" style="list-style: none; padding: 0;">
                    <li style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px dashed #f0f2f5;"><span>Contact Phone:</span><strong>${person.phone || 'None'}</strong></li>
                    <li style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:none;"><span>Outstanding credit:</span><strong>Rs ${balance.toFixed(2)}</strong></li>
                </ul>
                <div class="price-info" style="margin-top: 1rem; border-top: 2px solid #f0f2f5; padding-top: 1rem;">
                    <button class="btn btn-outline-primary" style="width: 100%; padding: 8px; font-size: 0.8rem; font-weight: 700; cursor: pointer;" onclick="openStatementModal('${person.id}', '${person.name.replace(/'/g, "\\'")}', ${balance})">
                        <i class="fas fa-file-invoice-dollar"></i> View Statement
                    </button>
                </div>
            </div>
        </div>`;
};

// Statement Ledger Modal Functions for Dashboard
function openStatementModal(personId, name, balance) {
    document.getElementById('stmtCustomerName').textContent = name;
    document.getElementById('stmtOutstanding').textContent = 'Rs ' + balance.toFixed(2);
    
    const list = document.getElementById('stmtList');
    if (list) {
        list.innerHTML = `<div style="text-align:center; padding:2rem; opacity:0.5;"><i class="fas fa-circle-notch fa-spin fa-2x"></i><p style="margin-top:5px;">Loading statement...</p></div>`;
    }

    const m = document.getElementById('statementModal');
    if (m) {
        m.style.display = 'flex';
        setTimeout(() => m.classList.add('active'), 10);
    }

    // Fetch ledger entries once
    creditsTransactionsRef.child(personId).once('value', snap => {
        if (!list) return;
        list.innerHTML = '';
        const txs = [ ];
        if (snap.exists()) {
            snap.forEach(child => {
                const tx = child.val();
                tx.id = child.key;
                txs.push(tx);
            });
        }

        if (txs.length === 0) {
            list.innerHTML = `<li style="text-align:center; padding:2rem; opacity:0.5; border-bottom:none;">No credit transactions found</li>`;
            return;
        }

        // Sort chronological newest first
        txs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        list.innerHTML = txs.map(t => {
            const dateStr = new Date(t.timestamp).toLocaleString();
            let itemsHTML = '';
            if (t.items && Array.isArray(t.items)) {
                itemsHTML = `<div style="margin-top:5px; padding-left:10px; border-left:2px solid #ddd; font-size:0.8rem; color:var(--gray);">` +
                    t.items.map(item => `${item.name} × ${item.qty || 1}`).join('<br>') +
                    `</div>`;
            } else if (t.items && typeof t.items === 'object') {
                itemsHTML = `<div style="margin-top:5px; padding-left:10px; border-left:2px solid #ddd; font-size:0.8rem; color:var(--gray);">` +
                    Object.values(t.items).map(item => `${item.name} × ${item.qty || 1}`).join('<br>') +
                    `</div>`;
            }

            return `
            <li class="statement-item" style="padding:10px 0; border-bottom:1px solid #f0f2f5; font-size:0.9rem; display:flex; justify-content:space-between; align-items:flex-start;">
                <div class="tx-left" style="display:flex; flex-direction:column; gap:3px;">
                    <span class="tx-type ${t.type}">${t.type === 'addition' ? 'Owed' : 'Paid'}</span>
                    <span class="tx-date" style="font-size:0.75rem; color:var(--gray);">${dateStr}</span>
                    <span class="tx-desc" style="font-size:0.85rem; color:var(--dark); margin-top:3px;">${t.note || (t.type === 'addition' ? 'Food Order' : 'Settle Payment')}</span>
                    ${itemsHTML}
                </div>
                <div class="tx-amount ${t.type}" style="font-weight:800; font-size:1rem; text-align:right;">
                    ${t.type === 'addition' ? '+' : '-'} Rs ${t.amount.toFixed(2)}
                </div>
            </li>`;
        }).join('');
    }).catch(err => {
        console.error(err);
        if (list) {
            list.innerHTML = `<li style="text-align:center; padding:2rem; color:var(--danger); border-bottom:none;">Error loading ledger</li>`;
        }
    });
}

function closeStatementModal() {
    const m = document.getElementById('statementModal');
    if (m) {
        m.classList.remove('active');
        setTimeout(() => m.style.display = 'none', 300);
    }
}

// Order deletion state
let orderIdToDelete = null;
let orderTypeToDelete = null;

// Open confirmation modal for order deletion
function confirmDeleteOrder(orderId, type) {
    orderIdToDelete = orderId;
    orderTypeToDelete = type;
    const m = document.getElementById('deleteConfirmModal');
    if (m) {
        m.style.display = 'flex';
        setTimeout(() => m.classList.add('active'), 10);
    }
}

// Close confirmation modal for order deletion
function closeDeleteModal() {
    const m = document.getElementById('deleteConfirmModal');
    if (m) {
        m.classList.remove('active');
        setTimeout(() => m.style.display = 'none', 300);
    }
    orderIdToDelete = null;
    orderTypeToDelete = null;
}

// Execute the database removal operation for the specified order
async function executeDeleteOrder() {
    if (!orderIdToDelete || !orderTypeToDelete) return;
    
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const originalText = confirmBtn.innerHTML;
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    
    try {
        if (orderTypeToDelete === 'sales') {
            await totalOrdersRef.child(orderIdToDelete).remove();
        } else if (orderTypeToDelete === 'cancelled') {
            await cancelledOrdersRef.child(orderIdToDelete).remove();
        }
        
        showToast('Order deleted successfully', 'success');
        closeDeleteModal();
        
        // Refresh dashboard data
        await fetchAllData();
    } catch (err) {
        console.error('Error deleting order:', err);
        showToast('Failed to delete order', 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalText;
    }
}

// Bind to window for inline HTML actions
window.setView = setView;
window.openStatementModal = openStatementModal;
window.closeStatementModal = closeStatementModal;
window.confirmDeleteOrder = confirmDeleteOrder;
window.closeDeleteModal = closeDeleteModal;
window.executeDeleteOrder = executeDeleteOrder;

// Open clear cancelled orders modal
function promptClearCancelledOrders() {
    const passwordInput = document.getElementById('deleteConfirmPassword');
    if (passwordInput) passwordInput.value = '';
    const m = document.getElementById('clearCancelledModal');
    if (m) {
        m.style.display = 'flex';
        setTimeout(() => m.classList.add('active'), 10);
    }
}

// Close clear cancelled orders modal
function closeClearCancelledModal() {
    const m = document.getElementById('clearCancelledModal');
    if (m) {
        m.classList.remove('active');
        setTimeout(() => m.style.display = 'none', 300);
    }
}

// Re-authenticate and execute clearing of filtered cancelled orders
async function executeClearCancelledOrders() {
    const password = document.getElementById('deleteConfirmPassword').value;
    if (!password) {
        showToast('Please enter your admin password', 'error');
        return;
    }
    
    const timeRange = document.getElementById('deleteTimeRange').value;
    const confirmBtn = document.getElementById('executeClearCancelledBtn');
    const originalText = confirmBtn.innerHTML;
    
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
    
    try {
        const user = firebase.auth().currentUser;
        if (!user || !user.email) {
            throw new Error('No active admin session found. Please re-login.');
        }
        
        // Re-authenticate using the typed password
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, password);
        await user.reauthenticateWithCredential(credential);
        
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
        
        // Fetch snapshot of cancelled orders
        const cancelledSnapshot = await cancelledOrdersRef.once('value');
        if (!cancelledSnapshot.exists()) {
            showToast('No cancelled orders found to delete', 'warning');
            closeClearCancelledModal();
            return;
        }
        
        const now = Date.now();
        const promises = [];
        let deletedCount = 0;
        
        cancelledSnapshot.forEach(child => {
            const order = child.val();
            const orderId = child.key;
            const orderTime = new Date(order.cancelledAt || order.timestamp).getTime();
            const diffMs = now - orderTime;
            
            let shouldDelete = false;
            if (timeRange === 'all') {
                shouldDelete = true;
            } else if (timeRange === 'older_24h' && diffMs > 24 * 60 * 60 * 1000) {
                shouldDelete = true;
            } else if (timeRange === 'older_7d' && diffMs > 7 * 24 * 60 * 60 * 1000) {
                shouldDelete = true;
            } else if (timeRange === 'older_30d' && diffMs > 30 * 24 * 60 * 60 * 1000) {
                shouldDelete = true;
            }
            
            if (shouldDelete) {
                promises.push(cancelledOrdersRef.child(orderId).remove());
                deletedCount++;
            }
        });
        
        if (promises.length > 0) {
            await Promise.all(promises);
            showToast(`Successfully deleted ${deletedCount} cancelled orders`, 'success');
        } else {
            showToast('No cancelled orders matched the selected time range', 'info');
        }
        
        closeClearCancelledModal();
        await fetchAllData();
    } catch (err) {
        console.error('Error clearing cancelled orders:', err);
        showToast(err.message || 'Verification failed. Incorrect password.', 'error');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalText;
    }
}

// Bind to window for clear-cancelled handlers
window.promptClearCancelledOrders = promptClearCancelledOrders;
window.closeClearCancelledModal = closeClearCancelledModal;
window.executeClearCancelledOrders = executeClearCancelledOrders;

// Initialize Dashboard
window.addEventListener('load', () => {
    injectHeader('Dashboard.html');
    fetchAllData();
    
    document.getElementById('searchBox').addEventListener('input', applyFilters);
    document.getElementById('timeFilter').addEventListener('change', applyFilters);
    document.getElementById('sortOrder').addEventListener('change', applyFilters);

    setInterval(() => {
        document.querySelectorAll('.timestamp').forEach(el => {
            if (!el.dataset.time) return;
            const time = el.dataset.time;
            const relative = formatRelativeTime(time);
            const relativeSpan = el.querySelector('.time-ago');
            
            if (relativeSpan) {
                relativeSpan.textContent = `(${relative})`;
            }
        });
    }, 1000);
});
