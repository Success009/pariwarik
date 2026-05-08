// Inventory Logic
let menuItemsData = { }, menuStatsMap = { }, rawMaterialsData = { }, rawUsageMap = { };

const importRef = commonRefs.importItems;
const usageRef = commonRefs.usageRecords;
const menuRef = commonRefs.menu;
const menuTxRef = commonRefs.menuTransactions;

const setView = (view) => { 
    document.getElementById('addPanel').classList.toggle('active', view === 'add'); 
    document.getElementById('usagePanel').classList.toggle('active', view === 'usage'); 
    document.querySelectorAll('.view-toggle .view-btn').forEach(btn => btn.classList.remove('active')); 
    const targetIdx = view === 'add' ? 0 : 1;
    document.querySelectorAll('.view-toggle .view-btn')[targetIdx].classList.add('active'); 
};

const createSearchHandler = (inputId, suggestionsId, onSelectCallback) => {
    const input = document.getElementById(inputId), suggestions = document.getElementById(suggestionsId);
    const getRelevance = (itemName, query) => { 
        const name = itemName.toLowerCase(), q = query.toLowerCase(); 
        if (name === q) return { score: 0, len: name.length }; 
        if (name.startsWith(q)) return { score: 1, len: name.length }; 
        return { score: 2, len: name.length }; 
    };

    input.addEventListener('input', () => {
        const query = input.value.toLowerCase(); 
        suggestions.innerHTML = ''; 
        if (onSelectCallback) onSelectCallback(null); 
        if (query.length < 1) return suggestions.style.display = 'none';
        
        const allMatches = [ ];
        Object.entries(rawMaterialsData).forEach(([key, item]) => { 
            if (item.name.toLowerCase().includes(query)) allMatches.push({ ...item, key, type: 'raw', relevance: getRelevance(item.name, query) }); 
        });
        Object.entries(menuItemsData).forEach(([key, item]) => { 
            if (item.name.toLowerCase().includes(query)) allMatches.push({ ...item, key, type: 'menu', relevance: getRelevance(item.name, query) }); 
        });
        
        allMatches.sort((a, b) => { 
            if (a.type !== b.type) return a.type === 'raw' ? -1 : 1; 
            if (a.relevance.score !== b.relevance.score) return a.relevance.score - b.relevance.score; 
            return a.name.localeCompare(b.name); 
        });

        let currentHeader = '';
        allMatches.forEach(item => { 
            const headerText = item.type === 'raw' ? 'Raw Materials' : 'Menu Items'; 
            if (headerText !== currentHeader) { 
                const headerDiv = document.createElement('div');
                headerDiv.className = 'suggestion-header';
                headerDiv.textContent = headerText;
                suggestions.appendChild(headerDiv);
                currentHeader = headerText; 
            } 
            const div = document.createElement('div'); 
            div.className = 'suggestion-item'; 
            div.innerHTML = `<span>${item.name}</span><small>${item.category || item.type || ''}</small>`; 
            div.dataset.key = item.key; 
            div.dataset.name = item.name; 
            div.dataset.type = item.type; 
            suggestions.appendChild(div); 
        });
        if (allMatches.length > 0) suggestions.style.display = 'block';
    });

    suggestions.addEventListener('click', (e) => { 
        const target = e.target.closest('.suggestion-item'); 
        if (target) { 
            input.value = target.dataset.name; 
            suggestions.style.display = 'none'; 
            if (onSelectCallback) onSelectCallback(target.dataset); 
        } 
    });
};

const resetAddForm = (form) => { 
    form.reset(); 
    document.getElementById('rawMaterialFields').style.display = 'block'; 
    document.getElementById('itemUnit').disabled = false; 
};

const deleteRawMaterial = (key) => { 
    if(confirm('Delete Raw Material? This will remove the import and all usage data.')) {
        const updates = { }; 
        updates[`/import_items/${key}`] = null; 
        usageRef.orderByChild('importKey').equalTo(key).once('value', s => { 
            s.forEach(c => { updates[`/usage_records/${c.key}`] = null; }); 
            firebase.database().ref().update(updates).then(() => showToast('Item deleted.', 'success')).catch(err => showToast('Deletion failed.', 'error')); 
        }); 
    }
};

const renderInventory = () => {
    const menuListEl = document.getElementById('menuItemsList'), rawListEl = document.getElementById('rawMaterialsList');
    if(!menuListEl || !rawListEl) return;

    menuListEl.innerHTML = '<p class="no-results-message" style="display: none;">No matching menu items found.</p>';
    rawListEl.innerHTML = '<p class="no-results-message" style="display: none;">No matching raw materials found.</p>';
    
    const sortedMenu = Object.entries(menuItemsData).sort((a,b) => a[1].name.localeCompare(b[1].name));
    if (sortedMenu.length === 0) menuListEl.insertAdjacentHTML('afterbegin', '<p class="no-results-message">No menu items defined.</p>');
    
    sortedMenu.forEach(([key, item]) => { 
        const stats = menuStatsMap[key] || { added: 0, used: 0 }; 
        const remaining = stats.added - stats.used; 
        const listItem = document.createElement('li'); 
        listItem.className = 'list-item menu-item'; 
        listItem.innerHTML = `<div class="item-info"><div class="item-name">${item.name}</div><div class="item-sub-details">${item.category}</div></div><div class="item-stats"><div class="inventory-stat">Added<span>${stats.added.toFixed(2)}</span></div><div class="inventory-stat">Used<span>${stats.used.toFixed(2)}</span></div><div class="inventory-stat">Remaining<span class="remaining">${remaining.toFixed(2)}</span></div></div>`; 
        menuListEl.appendChild(listItem); 
    });

    const sortedRaw = Object.entries(rawMaterialsData).sort((a,b) => b[1].createdAt - a[1].createdAt);
    if (sortedRaw.length === 0) rawListEl.insertAdjacentHTML('afterbegin', '<p class="no-results-message">No raw materials imported.</p>');
    
    sortedRaw.forEach(([key, item]) => { 
        const totalUsed = rawUsageMap[key] || 0; 
        const remaining = item.quantity - totalUsed; 
        let costHTML = ''; 
        if (item.price > 0 && item.quantity > 0) costHTML = `<span class="item-cost">Rs ${(item.price / item.quantity).toFixed(2)}/${item.unit}</span>`; 
        const listItem = document.createElement('li'); 
        listItem.className = 'list-item raw-material'; 
        listItem.innerHTML = `<div class="item-info"><div class="item-name-line"><span class="item-name">${item.name}</span>${costHTML}</div><div class="item-sub-details">${new Date(item.createdAt).toLocaleDateString()} - ${item.type||'N/A'}</div></div><div class="item-stats"><div class="inventory-stat">Imported<span>${item.quantity} ${item.unit}</span></div><div class="inventory-stat">Used<span>${totalUsed.toFixed(2)} ${item.unit}</span></div><div class="inventory-stat">Remaining<span class="remaining">${remaining.toFixed(2)} ${item.unit}</span></div></div><button class="btn btn-danger btn-icon" onclick="deleteRawMaterial('${key}')" style="padding: 5px 10px; width: auto;"><i class="fas fa-trash"></i></button>`; 
        rawListEl.appendChild(listItem); 
    });
    
    const searchVal = document.getElementById('inventorySearch').value;
    if(searchVal) document.getElementById('inventorySearch').dispatchEvent(new Event('input'));
};

window.addEventListener('load', () => {
    injectHeader('ImportProgram.html');

    createSearchHandler('itemName_add', 'suggestions_add', (data) => { 
        document.getElementById('rawMaterialFields').style.display = data ? 'none' : 'block'; 
        document.getElementById('itemUnit').disabled = !!data; 
        document.getElementById('selectedItemKey_add').value = data ? data.key : ''; 
        document.getElementById('selectedItemType_add').value = data ? data.type : ''; 
    });

    createSearchHandler('itemName_usage', 'suggestions_usage', (data) => {
        const stockDisplay = document.getElementById('currentStockDisplay').querySelector('strong');
        if (data) { 
            const item = data.type === 'menu' ? menuItemsData[data.key] : rawMaterialsData[data.key]; 
            const stats = data.type === 'menu' ? (menuStatsMap[data.key] || {added:0, used:0}) : {added:item.quantity, used:(rawUsageMap[data.key]||0)}; 
            const remaining = stats.added - stats.used; 
            stockDisplay.textContent = `${Number(remaining).toFixed(2)} ${item.unit || ''}`; 
        } else { 
            stockDisplay.textContent = 'N/A'; 
        }
        document.getElementById('selectedItemKey_usage').value = data ? data.key : ''; 
        document.getElementById('selectedItemType_usage').value = data ? data.type : '';
    });

    document.getElementById('addForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const selectedKey = document.getElementById('selectedItemKey_add').value, type = document.getElementById('selectedItemType_add').value;
        const quantity = parseFloat(document.getElementById('itemQuantity_add').value);
        if (!quantity || quantity <= 0) return showToast('Please enter a valid quantity.', 'warning');
        
        if (type === 'menu') { 
            menuTxRef.push({ menuItemKey: selectedKey, quantity: quantity, createdAt: firebase.database.ServerValue.TIMESTAMP }).then(() => { showToast('Menu stock updated.'); resetAddForm(e.target); });
        } else if (type === 'raw') {
            importRef.child(selectedKey).transaction(currentItem => { if (currentItem) { currentItem.quantity += quantity; } return currentItem; }).then(() => { showToast('Raw material stock updated.'); resetAddForm(e.target); });
        } else { 
            importRef.push({ name: document.getElementById('itemName_add').value, type: document.getElementById('itemType').value, quantity: quantity, unit: document.getElementById('itemUnit').value, price: parseFloat(document.getElementById('totalPrice').value) || 0, createdAt: firebase.database.ServerValue.TIMESTAMP }).then(() => { showToast('New raw material added.'); resetAddForm(e.target); }); 
        }
    });

    document.getElementById('itemUsageForm').addEventListener('submit', (e) => { 
        e.preventDefault(); 
        const key = document.getElementById('selectedItemKey_usage').value, type = document.getElementById('selectedItemType_usage').value; 
        const quantityUsed = parseFloat(document.getElementById('itemQuantity_usage').value); 
        if (!key || !type) return showToast('Please select a valid item from search.', 'warning'); 
        if (!quantityUsed || quantityUsed <= 0) return showToast('Please enter a valid quantity used.', 'warning'); 
        if (type === 'menu') { 
            menuTxRef.push({ menuItemKey: key, quantity: -quantityUsed, createdAt: firebase.database.ServerValue.TIMESTAMP }).then(() => { showToast('Menu usage recorded.'); e.target.reset(); }); 
        } else if (type === 'raw') { 
            usageRef.push({ importKey: key, quantityUsed: quantityUsed, createdAt: firebase.database.ServerValue.TIMESTAMP }).then(() => { showToast('Raw material usage recorded.'); e.target.reset(); }); 
        } 
        document.getElementById('currentStockDisplay').querySelector('strong').textContent = 'N/A'; 
    });

    document.getElementById('inventorySearch').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filterList = (listId, itemSelector) => {
            const list = document.getElementById(listId); 
            const items = list.querySelectorAll(itemSelector); 
            let visibleCount = 0;
            items.forEach(item => { 
                const isVisible = item.querySelector('.item-name').textContent.toLowerCase().includes(query); 
                item.style.display = isVisible ? 'flex' : 'none'; 
                if (isVisible) visibleCount++; 
            });
            const noResultsMsg = list.querySelector('.no-results-message'); 
            if (noResultsMsg) noResultsMsg.style.display = visibleCount === 0 && query !== '' ? 'block' : 'none';
        };
        filterList('rawMaterialsList', '.list-item.raw-material');
        filterList('menuItemsList', '.list-item.menu-item');
    });

    document.addEventListener('click', (e) => { 
        if (!e.target.closest('.form-group')) { 
            document.querySelectorAll('.suggestions-container').forEach(el => el.style.display = 'none'); 
        } 
    });

    menuRef.on('value', snapshot => { menuItemsData = snapshot.val() || { }; renderInventory(); });
    importRef.on('value', snapshot => { rawMaterialsData = snapshot.val() || { }; renderInventory(); });
    menuTxRef.on('value', snapshot => { 
        menuStatsMap = { }; 
        snapshot.forEach(child => { 
            const tx = child.val(); 
            if (!menuStatsMap[tx.menuItemKey]) menuStatsMap[tx.menuItemKey] = { added: 0, used: 0 }; 
            if (tx.quantity > 0) menuStatsMap[tx.menuItemKey].added += tx.quantity; 
            else menuStatsMap[tx.menuItemKey].used += Math.abs(tx.quantity); 
        }); 
        renderInventory(); 
    });
    usageRef.on('value', snapshot => { 
        rawUsageMap = { }; 
        snapshot.forEach(child => { 
            const u = child.val(); 
            rawUsageMap[u.importKey] = (rawUsageMap[u.importKey] || 0) + u.quantityUsed; 
        }); 
        renderInventory(); 
    });
});