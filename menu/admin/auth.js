(function() {
    // Unique local config name to avoid any chance of collision with global scope
    // Firebase is now initialized in admin-common.js
    
    const auth = firebase.auth();

    // Export logout function to global window so HTML onclick can see it
    window.logout = function() {
        auth.signOut().then(() => {
            window.location.replace('index.html');
        }).catch(err => console.error("Logout error:", err));
    };

    // Global guard for all admin pages
    auth.onAuthStateChanged(user => {
        const isLogin = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/admin/');
        
        if (user) {
            if (isLogin) window.location.replace('StaffOrder.html');
        } else {
            if (!isLogin) window.location.replace('index.html');
        }
    });

    // Handle the Login Form specifically for index.html
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const errorMsg = document.getElementById('error-message');
            const btn = document.querySelector('.btn-login');

            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
            btn.disabled = true;
            if(errorMsg) errorMsg.style.display = 'none';

            auth.signInWithEmailAndPassword(email, password)
                .catch(err => {
                    if(errorMsg) {
                        errorMsg.textContent = err.message;
                        errorMsg.style.display = 'block';
                    }
                    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Secure Sign-In';
                    btn.disabled = false;
                });
        });
    }
})();