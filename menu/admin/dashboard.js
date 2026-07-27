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

        const todayDateObj = new Date();
    const todayDay = todayDateObj.getDate();
    const todayMonth = todayDateObj.getMonth();
    const todayYear = todayDateObj.getFullYear();

        // Helper to evaluate if a timestamp occurred on the current calendar day
    const isToday = (dateVal) => {
        if (!dateVal) return false;
        const date = (dateVal instanceof Date) ? dateVal : new Date(dateVal);
        if (isNaN(date.getTime())) return false;
        return date.getDate() === todayDay &&
            date.getMonth() === todayMonth &&
            date.getFullYear() === todayYear;
    };

    // Process Cancelled Orders
    allCancelled = [ ];
    if (cancelledSnapshot.exists()) {
        cancelledSnapshot.forEach(child => {
            const order = child.val();
            if (!order) return;
            order.id = child.key;
            let orderTotal = 0;
            if (order.items && Array.isArray(order.items)) {
                order.items.forEach(item => {
                    if (!item || item.isDivider) return;
                    const name = item.name || "Unknown Item";
                    const meta = menuCache[name] || { };
                    const pricePerUnit = item.price !== undefined ? item.price : (meta.price || 0) / (meta.startingValue || 1);
                    const qty = parseFloat(item.qty || item.quantity || 1);
                    orderTotal += pricePerUnit * (isNaN(qty) ? 0 : qty);
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
            if (!order) return;
            order.id = child.key;
            let orderTotal = 0;
            if (order.items && Array.isArray(order.items)) {
                order.items.forEach(item => {
                    if (!item || item.isDivider) return;
                    const name = item.name || "Unknown Item";
                    const meta = menuCache[name] || { };
                    const pricePerUnit = item.price !== undefined ? item.price : (meta.price || 0) / (meta.startingValue || 1);
                    const qty = parseFloat(item.qty || item.quantity || 1);
                    orderTotal += pricePerUnit * (isNaN(qty) ? 0 : qty);
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

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today); 
    thisWeek.setDate(today.getDate() - today.getDay());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Pre-cache localized calendar structures to keep performance fast
    const todayDateObj = new Date();
    const todayDay = todayDateObj.getDate();
    const todayMonth = todayDateObj.getMonth();
    const todayYear = todayDateObj.getFullYear();

    // A robust, null-safe checker that supports both String and Date types without throwing RangeErrors
    const isToday = (dateVal) => {
        if (!dateVal) return false;
        const date = (dateVal instanceof Date) ? dateVal : new Date(dateVal);
        if (isNaN(date.getTime())) return false;
        return date.getDate() === todayDay &&
            date.getMonth() === todayMonth &&
            date.getFullYear() === todayYear;
    };

    // Helper to evaluate if a specific Date matches the selected timeframe filter
    const matchesTimeFilter = (dateObj) => {
        if (!dateObj || isNaN(dateObj.getTime())) return false;

        if (timeFilter === 'today') return isToday(dateObj);
        if (timeFilter === 'week') return dateObj >= thisWeek;
        if (timeFilter === 'month') return dateObj >= thisMonth;
        if (timeFilter === 'specific') {
            const pickerVal = document.getElementById('datePicker').value;
            if (!pickerVal) return false;
            const targetDate = new Date(pickerVal);
            return dateObj.getDate() === targetDate.getDate() &&
                dateObj.getMonth() === targetDate.getMonth() &&
                dateObj.getFullYear() === targetDate.getFullYear();
        }
        return true; // 'all' time
    };

    // If current tab is "Items Specific", build the dynamic map of units sold
    if (currentView === 'itemSales') {
        const itemSalesMap = {};

        allOrders.forEach(order => {
            if (!order) return;
            const orderDateStr = order.completedAt || order.timestamp;
            if (orderDateStr) {
                const orderDate = new Date(orderDateStr);
                if (matchesTimeFilter(orderDate)) {
                    (order.items || []).forEach(item => {
                        if (!item || item.isDivider) return;
                        const name = item.name || "Unknown Item";
                        const qty = parseFloat(item.qty || item.quantity || 1);
                        if (!itemSalesMap[name]) {
                            const meta = menuCache[name] || {};
                            itemSalesMap[name] = {
                                name: name,
                                qty: 0,
                                id: meta.id || '',
                                category: meta.category || 'Other'
                            };
                        }
                        itemSalesMap[name].qty += isNaN(qty) ? 0 : qty;
                    });
                }
            }
        });

        // Convert key/value structure and filter by search box query
        filteredItems = Object.values(itemSalesMap).filter(item => {
            const name = item.name || "";
            const category = item.category || "";
            return !searchTerm || name.toLowerCase().includes(searchTerm) || category.toLowerCase().includes(searchTerm);
        });

        // Sort by quantities sold (highest first)
        filteredItems.sort((a, b) => b.qty - a.qty);
        renderContent();
        return;
    }

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

    filteredItems = sourceData.filter(item => {
        const itemDate = new Date(item[timestampField]);
        let matchesTime = true;

        if (currentView !== 'credits') {
            matchesTime = matchesTimeFilter(itemDate);
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
        const timeFilterEl = document.getElementById('timeFilter');
        const timeFilter = timeFilterEl ? timeFilterEl.value : 'all';
        let title = 'No Items Found';
        let msg = 'Try changing your filters or view.';

        if (timeFilter === 'all') {
            title = 'No Data Available';
            if (currentView === 'itemSales') {
                msg = 'No items have been sold yet.';
            } else if (currentView === 'sales') {
                msg = 'No completed sales recorded yet.';
            } else if (currentView === 'cancelled') {
                msg = 'No cancelled orders recorded yet.';
            } else if (currentView === 'imports') {
                msg = 'No import records found.';
            } else if (currentView === 'credits') {
                msg = 'No customer accounts registered yet.';
            }
        } else if (timeFilter === 'today') {
            title = 'No Data Today';
            if (currentView === 'itemSales') {
                msg = 'No items have been sold today.';
            } else if (currentView === 'sales') {
                msg = 'No completed sales recorded today.';
            } else if (currentView === 'cancelled') {
                msg = 'No cancelled orders recorded today.';
            } else if (currentView === 'imports') {
                msg = 'No import records today.';
            }
        }

        container.innerHTML = `<div class="empty-state"><i class="fas fa-filter"></i><h3>${title}</h3><p>${msg}</p></div>`;
        return;
    }

    // Slice array to top 100 items to avoid DOM overload and keep navigation extremely snappy
    const visibleItems = filteredItems.slice(0, 100);

    let html = '';
    visibleItems.forEach(item => {
        if (currentView === 'sales') html += createSaleCard(item);
        else if (currentView === 'cancelled') html += createCancelledCard(item);
        else if (currentView === 'imports') html += createImportCard(item);
        else if (currentView === 'credits') html += createCreditCard(item);
        else if (currentView === 'itemSales') html += createItemSalesCard(item);
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

// Helper to toggle visibility of the specific date picker input based on timeframe selection
const toggleDatePickerVisibility = (filterValue) => {
    const picker = document.getElementById('datePicker');
    if (picker) {
        picker.style.display = filterValue === 'specific' ? 'inline-block' : 'none';
    }
};

const setView = (view) => {
    currentView = view;
    document.getElementById('viewSalesBtn').classList.toggle('active', view === 'sales');
    document.getElementById('viewCancelledBtn').classList.toggle('active', view === 'cancelled');
    document.getElementById('viewImportsBtn').classList.toggle('active', view === 'imports');

    const creditsBtn = document.getElementById('viewCreditsBtn');
    if (creditsBtn) creditsBtn.classList.toggle('active', view === 'credits');

    const itemSalesBtn = document.getElementById('viewItemSalesBtn');
    if (itemSalesBtn) itemSalesBtn.classList.toggle('active', view === 'itemSales');

    let placeholder = 'Search sales...';
    if (view === 'cancelled') placeholder = 'Search cancelled orders...';
    else if (view === 'imports') placeholder = 'Search inventory...';
    else if (view === 'credits') placeholder = 'Search customer accounts...';
    else if (view === 'itemSales') placeholder = 'Search item names...';

    document.getElementById('searchBox').placeholder = placeholder;

    const clearBtn = document.getElementById('clearCancelledBtn');
    if (clearBtn) {
        clearBtn.style.display = view === 'cancelled' ? 'inline-block' : 'none';
    }

    // Default the timeframe filter to 'today' when switching to the item specific sales tab
    if (view === 'itemSales') {
        const timeFilterEl = document.getElementById('timeFilter');
        if (timeFilterEl && timeFilterEl.value === 'all') {
            timeFilterEl.value = 'today';
            toggleDatePickerVisibility('today');
        }
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

// Creates a beautifully styled itemSpecific sales card, complete with Fallback image loading
const createItemSalesCard = (item) => {
    // Standardizes item names according to storage ref formatting guidelines
    const itemName = item.name || "Unknown Item";
    const itemCategory = item.category || "Other";
    const itemQty = item.qty !== undefined ? item.qty : 0;
    const cleanName = itemName.replace(/\s+/g, '') + '.jpg';
    const imgUrl = `https://firebasestorage.googleapis.com/v0/b/deep-freehold-389006.appspot.com/o/images%2F${cleanName}?alt=media`;

    return `
        <div class="data-card" style="display:flex; align-items:center; padding:1.25rem; gap:1.25rem;">
            <img src="${imgUrl}" onerror="this.onerror=null; this.src='https://placehold.co/100x100?text=No+Image';" style="width:65px; height:65px; object-fit:cover; border-radius:12px; background:#f0f2f5; flex-shrink:0; box-shadow:var(--shadow);">
            <div style="flex:1; min-width:0;">
                <div style="font-weight:800; font-size:1.1rem; color:var(--dark); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-transform:uppercase; letter-spacing:0.5px;">${itemName}</div>
                <div style="font-size:0.8rem; color:var(--gray); margin-top:2px;">Category: ${itemCategory}</div>
            </div>
            <div style="text-align:right; flex-shrink:0;">
                <div style="font-size:0.75rem; text-transform:uppercase; color:var(--gray); font-weight:700; letter-spacing:0.5px;">Units Sold</div>
                <div style="font-size:1.8rem; font-weight:800; color:var(--primary); line-height:1;">${itemQty}</div>
            </div>
        </div>`;
};

// Bind to window for clear-cancelled handlers
window.promptClearCancelledOrders = promptClearCancelledOrders;
window.closeClearCancelledModal = closeClearCancelledModal;
window.executeClearCancelledOrders = executeClearCancelledOrders;

// A simple debounce utility to defer expensive function calls during rapid keystrokes
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(null, args);
        }, delay);
    };
};

// Initialize Dashboard
window.addEventListener('load', () => {
    injectHeader('Dashboard.html');
    fetchAllData();

    // Applying debounce to keystrokes on the search input prevents redundant DOM rebuilds
    const debouncedApplyFilters = debounce(applyFilters, 150);
    document.getElementById('searchBox').addEventListener('input', debouncedApplyFilters);

    document.getElementById('timeFilter').addEventListener('change', (e) => {
        toggleDatePickerVisibility(e.target.value);
        applyFilters();
    });
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
