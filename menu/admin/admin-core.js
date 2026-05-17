// Admin Core - Shared logic and Firebase Initialization

const firebaseConfig = {
    apiKey: "AIzaSyDlnzH1D7D7Q663eWE086ng_1KdP46MZEs",
    authDomain: "deep-freehold-389006.firebaseapp.com",
    databaseURL: "https://deep-freehold-389006-default-rtdb.firebaseio.com",
    projectId: "deep-freehold-389006",
    storageBucket: "deep-freehold-389006.appspot.com",
    messagingSenderId: "76562961838",
    appId: "1:76562961838:web:4d18b2f79d7eb9fd88243f",
    measurementId: "G-VZC36FJC24"
};

// Initialize Firebase immediately
if (!firebase.apps || firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}

// Define global refs using 'var' to ensure availability across scripts
var commonDB = firebase.database();
    
var commonRefs = {
    menu: commonDB.ref('menu'),
    orders: commonDB.ref('orders'),
    totalOrders: commonDB.ref('totalorders'),
    cancelledOrders: commonDB.ref('cancelled_orders'),
    importItems: commonDB.ref('import_items'),
    usageRecords: commonDB.ref('usage_records'),
    menuTransactions: commonDB.ref('menu_item_transactions')
};

/**
 * Injects the standard admin header into the page.
 */
function injectHeader(activePage) {
    const headerHTML = `
    <header class="app-header">
        <div class="header-title">Admin Panel</div>
        <nav class="header-nav">
            ${activePage === 'Dashboard.html' ? `<a href="Dashboard.html" class="nav-link active"><i class="fas fa-chart-pie"></i> Dashboard</a>` : ''}
            <a href="StaffOrder.html" class="nav-link ${activePage === 'StaffOrder.html' ? 'active' : ''}"><i class="fas fa-concierge-bell"></i> Orders</a>
            <a href="StaffMenu.html" class="nav-link ${activePage === 'StaffMenu.html' ? 'active' : ''}"><i class="fas fa-book-open"></i> Menu</a>
            <a href="StaffUpload.html" class="nav-link ${activePage === 'StaffUpload.html' ? 'active' : ''}"><i class="fas fa-image"></i> Images</a>
            <a href="ImportProgram.html" class="nav-link ${activePage === 'ImportProgram.html' ? 'active' : ''}"><i class="fas fa-boxes"></i> Inventory</a>
            <a href="#" onclick="logout()" class="nav-link logout-btn"><i class="fas fa-sign-out-alt"></i> Logout</a>
        </nav>
    </header>`;
    document.body.insertAdjacentHTML('afterbegin', headerHTML);
}
    

/**
 * Global toast notification system.
 */
function showToast(msg, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    if (type === 'error') toast.style.borderLeftColor = 'var(--danger)';
    if (type === 'warning') toast.style.borderLeftColor = 'var(--warning)';
    
    const icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle');
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${msg}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = '0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}