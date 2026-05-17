// Dashboard Logic
let allOrders = [ ], allCancelled = [ ], allImports = [ ], filteredItems = [ ];
let currentView = 'sales';
let usageMap = { }; 
let menuCache = { };

const totalOrdersRef = commonRefs.totalOrders;
const cancelledOrdersRef = commonRefs.cancelledOrders;
const importItemsRef = commonRefs.importItems;
const usageRef = commonRefs.usageRecords;
const menuRef = commonRefs.menu;

const fetchAllData = async () => {
    const [menuSnapshot, ordersSnapshot, importsSnapshot, usageSnapshot, cancelledSnapshot] = await Promise.all([
        menuRef.once('value'),
        totalOrdersRef.limitToLast(500).once('value'),
        importItemsRef.limitToLast(500).once('value'),
        usageRef.limitToLast(500).once('value'),
        cancelledOrdersRef.limitToLast(100).once('value')
    ]);
    
    // Load Menu Cache first
    menuCache = { };
    menuSnapshot.forEach(child => {
        const item = child.val();
        menuCache[item.name] = { price: item.price || 0, startingValue: item.startingValue || 1 };
    });

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
            order.calculatedTotal = orderTotal;
            allOrders.push(order);
            totalRevenue += orderTotal;
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
    for (const [importKey, quantityUsed] of Object.entries(usageMap)) {
        const importItem = importsMap.get(importKey);
        if (importItem) {
            const pricePerUnit = importItem.price / importItem.quantity;
            costOfUsed += pricePerUnit * quantityUsed;
        }
    }
    
    const inventoryValue = totalImportValue - costOfUsed;

    updateStats({ totalRevenue, costOfUsed, inventoryValue });
    applyFilters();
};

const updateStats = (stats) => {
    document.getElementById('totalRevenue').textContent = "Rs " + stats.totalRevenue.toFixed(2);
    document.getElementById('costOfUsed').textContent = "Rs " + stats.costOfUsed.toFixed(2);
    document.getElementById('inventoryValue').textContent = "Rs " + stats.inventoryValue.toFixed(2);
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
    } else {
        sourceData = allImports;
        timestampField = 'createdAt';
        amountField = 'price';
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today); 
    thisWeek.setDate(today.getDate() - today.getDay());
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    filteredItems = sourceData.filter(item => {
        const itemDate = new Date(item[timestampField]);
        let matchesTime = true;
        if (timeFilter === 'today') matchesTime = itemDate >= today;
        else if (timeFilter === 'week') matchesTime = itemDate >= thisWeek;
        else if (timeFilter === 'month') matchesTime = itemDate >= thisMonth;
        
        let matchesSearch = !searchTerm || (currentView === 'sales'
            ? item.id.toLowerCase().includes(searchTerm) || (item.items && item.items.some(i => i.name && i.name.toLowerCase().includes(searchTerm)))
            : (item.name && item.name.toLowerCase().includes(searchTerm)) || (item.type && item.type.toLowerCase().includes(searchTerm)));
        
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
        else html += createImportCard(item);
    });
    container.innerHTML = html;
};

const createCancelledCard = (order) => {
    const orderItems = (order.items || [ ]).map(item => {
        if (item.isDivider) return '&lt;li class="item-divider"&gt;&lt;/li&gt;';
        return '<li><span>' + item.name + '</span><span>&times; ' + (item.qty || item.quantity || 1) + '</span></li>';
    }).join('');
    const location = order.tableNumber || order.landmark || order.roomNumber || ("Order #" + order.id.slice(-6));
    return `
        <div class="data-card">
            <div class="card-header cancelled"><div class="card-title"><span>${location}</span><i class="fas fa-ban"></i></div><div class="timestamp">Cancelled: ${new Date(order.cancelledAt || order.timestamp).toLocaleString()}</div></div>
            <div class="card-body">
                <ul class="item-list">${orderItems || '<li>No items in this order</li>'}</ul>
                <div class="price-info"><div class="total-price cancelled"><span>Lost Value:</span><span>Rs ${order.calculatedTotal.toFixed(2)}</span></div></div>
            </div>
        </div>`;
};
const createSaleCard = (order) => {
    const orderItems = (order.items || [ ]).map(item => {
        if (item.isDivider) return '&lt;li class="item-divider"&gt;&lt;/li&gt;';
        return '<li><span>' + item.name + '</span><span>&times; ' + (item.qty || item.quantity || 1) + '</span></li>';
    }).join('');
    const location = order.tableNumber || order.landmark || order.roomNumber || ("Order #" + order.id.slice(-6));
    return `
        <div class="data-card">
            <div class="card-header sales"><div class="card-title"><span>${location}</span><i class="fas fa-receipt"></i></div><div class="timestamp">${new Date(order.timestamp).toLocaleString()}</div></div>
            <div class="card-header sales"><div class="card-title"><span>Order #${order.id.slice(-6)}</span><i class="fas fa-receipt"></i></div><div class="timestamp">${new Date(order.timestamp).toLocaleString()}</div></div>
            <div class="card-body">
                <ul class="item-list">${orderItems || '<li>No items in this order</li>'}</ul>
                <div class="price-info"><div class="total-price sales"><span>Total Sale:</span><span>Rs ${order.calculatedTotal.toFixed(2)}</span></div></div>
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
    
    let placeholder = 'Search sales...';
    if (view === 'cancelled') placeholder = 'Search cancelled orders...';
    else if (view === 'imports') placeholder = 'Search inventory...';
    
    document.getElementById('searchBox').placeholder = placeholder;
    applyFilters();
};

// Initialize Dashboard
window.addEventListener('load', () => {
    injectHeader('Dashboard.html');
    fetchAllData();
    
    document.getElementById('searchBox').addEventListener('input', applyFilters);
    document.getElementById('timeFilter').addEventListener('change', applyFilters);
    document.getElementById('sortOrder').addEventListener('change', applyFilters);
});