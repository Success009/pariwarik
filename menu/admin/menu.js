// Menu Management Logic
const menuRef = commonRefs.menu;
let allItems = [ ];
let categories = new Set();

// Load Data
let renderTimeout;
function loadMenu() {
    // Optimization: Use a single listener but debounce the render 
    // to prevent UI freezing during rapid multiple updates
    menuRef.on('value', snapshot => {
        allItems = [ ];
        categories = new Set();
        snapshot.forEach(child => {
            const item = child.val();
            if (item.type === 'Hotel') {
                allItems.push({ id: child.key, ...item });
                if(item.category) categories.add(item.category);
            }
        });
        
        clearTimeout(renderTimeout);
        renderTimeout = setTimeout(() => {
            renderMenu();
            updateCategoryDropdown();
        }, 100); 
    });
}
    

function renderMenu() {
    const container = document.getElementById('menuContainer');
    const search = document.getElementById('searchInput').value.toLowerCase();
    
    if (allItems.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:5rem; opacity:0.5;"><h3>No items in menu yet.</h3></div>`;
        return;
    }

    const filtered = allItems.filter(i => 
        i.name.toLowerCase().includes(search) || 
        i.category.toLowerCase().includes(search)
    );

    const grouped = { };
    filtered.forEach(item => {
        if(!grouped[item.category]) grouped[item.category] = [ ];
        grouped[item.category].push(item);
    });

    let html = '';
    const sortedCats = Object.keys(grouped).sort();

    if (sortedCats.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:5rem; opacity:0.5;"><h3>No items matching your search.</h3></div>`;
        return;
    }

    sortedCats.forEach(cat => {
        html += `
        <div class="category-section">
            <div class="category-header">
                <h2 class="category-title">${cat}</h2>
                <button class="btn btn-warning btn-icon" onclick="openCategoryEdit('${cat}')" title="Rename Category">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
            <div class="menu-grid">
                ${grouped[cat].map(item => renderItemCard(item)).join('')}
            </div>
        </div>`;
    });
    container.innerHTML = html;
}

function renderItemCard(item) {
    const isOut = item.status === 'out_of_stock';
    const price = item.price || 0;
    const unit = item.unit ? ` per ${item.startingValue || 1} ${item.unit}` : '';
    
    return `
    <div class="menu-card" data-id="${item.id}">
        <span class="card-status ${isOut ? 'status-out' : 'status-in'}">
            ${isOut ? 'Out of Stock' : 'In Stock'}
        </span>
        <div class="card-body">
            <h3 class="item-name">${item.name}</h3>
            <div class="item-price">Rs ${price.toFixed(2)}<span style="font-size:0.8rem; color:var(--gray); font-weight:500;">${unit}</span></div>
            <div class="item-meta">
                <span class="badge">${item.category}</span>
                <span class="badge badge-rarity">${item.rarity || 'Basic'}</span>
            </div>
            <div class="card-actions">
                <button class="btn btn-warning" onclick="editItem('${item.id}')" title="Edit Item">
                    <i class="fas fa-edit"></i> <span>Edit</span>
                </button>
                <button class="btn ${isOut ? 'btn-success' : 'btn-warning'}" 
                        onclick="toggleStatus('${item.id}', '${item.status}')" 
                        title="${isOut ? 'Mark as Available' : 'Mark as Out of Stock'}">
                    <i class="fas ${isOut ? 'fa-toggle-on' : 'fa-toggle-off'}"></i> <span>${isOut ? 'Restock' : 'Out of Stock'}</span>
                </button>
                <button class="btn btn-danger" onclick="deleteItem('${item.id}')" title="Delete Item">
                    <i class="fas fa-trash-alt"></i> <span>Delete</span>
                </button>
            </div>
        </div>
    </div>`;
}

// Search
function filterItems() {
    renderMenu();
}

// Modals
function openModal(id) {
    document.getElementById(id).style.display = 'flex';
    if(id === 'itemModal') {
        document.getElementById('itemForm').reset();
        document.getElementById('itemId').value = '';
        document.getElementById('modalTitle').innerText = 'Add Menu Item';
        toggleCustomCategory('');
    }
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function toggleCustomCategory(val) {
    const group = document.getElementById('customCategoryGroup');
    if(val === 'NEW') group.classList.remove('hidden');
    else group.classList.add('hidden');
}

function updateCategoryDropdown() {
    const select = document.getElementById('itemCategory');
    if(!select) return;
    let html = '<option value="">Select Category</option>';
    Array.from(categories).sort().forEach(c => {
        html += `<option value="${c}">${c}</option>`;
    });
    html += `<option value="NEW" style="color:var(--primary); font-weight:bold;">+ Create New Category</option>`;
    select.innerHTML = html;
}

// Actions
function saveItem(e) {
    e.preventDefault();
    const id = document.getElementById('itemId').value;
    const name = document.getElementById('itemName').value;
    const price = parseFloat(document.getElementById('itemPrice').value);
    const startingValue = parseFloat(document.getElementById('itemStartingValue').value);
    const rarity = document.getElementById('itemRarity').value;
    const unit = document.getElementById('itemUnit').value;
    let category = document.getElementById('itemCategory').value;

    if(category === 'NEW') category = document.getElementById('customCategory').value;
    if(!category) return showToast('Please select or enter a category', 'error');

    const data = {
        name, price, category, startingValue, rarity, 
        type: 'Hotel', 
        status: 'in_stock'
    };
    if(unit) data.unit = unit;

    const promise = id ? menuRef.child(id).update(data) : menuRef.push(data);
    
    promise.then(() => {
        showToast(id ? 'Item updated' : 'Item added');
        closeModal('itemModal');
    }).catch(err => showToast(err.message, 'error'));
}

function editItem(id) {
    const item = allItems.find(i => i.id === id);
    if(!item) return;

    openModal('itemModal');
    document.getElementById('modalTitle').innerText = 'Edit Item';
    document.getElementById('itemId').value = item.id;
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemPrice').value = item.price;
    document.getElementById('itemStartingValue').value = item.startingValue || 1;
    document.getElementById('itemCategory').value = item.category;
    document.getElementById('itemRarity').value = item.rarity || 'Basic';
    document.getElementById('itemUnit').value = item.unit || '';
    
    toggleCustomCategory(item.category);
}

function toggleStatus(id, current) {
    const newStatus = current === 'out_of_stock' ? 'in_stock' : 'out_of_stock';
    menuRef.child(id).update({ status: newStatus })
        .then(() => showToast('Status updated'))
        .catch(err => showToast(err.message, 'error'));
}

function deleteItem(id) {
    if(confirm('Are you sure you want to delete this item permanently?')) {
        menuRef.child(id).remove()
            .then(() => showToast('Item deleted'))
            .catch(err => showToast(err.message, 'error'));
    }
}

// Category Management
let catToRename = '';
function openCategoryEdit(cat) {
    catToRename = cat;
    document.getElementById('currentCatLabel').innerText = cat;
    document.getElementById('newCategoryName').value = cat;
    openModal('categoryModal');
}

function performCategoryRename() {
    const newName = document.getElementById('newCategoryName').value.trim();
    if(!newName || newName === catToRename) return closeModal('categoryModal');

    const updates = { };
    allItems.forEach(item => {
        if(item.category === catToRename) {
            updates[`${item.id}/category`] = newName;
        }
    });

    menuRef.update(updates)
        .then(() => {
            showToast('Category renamed successfully');
            closeModal('categoryModal');
        })
        .catch(err => showToast(err.message, 'error'));
}

window.addEventListener('load', () => {
    injectHeader('StaffMenu.html');
    loadMenu();
});