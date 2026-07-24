// Order flow checkout logic and API communication
function setOrderType(type) {
    window.orderType = type;
    localStorage.setItem('order_type', type);
    
    const hotelFields = document.getElementById('hotelFields');
    const localFields = document.getElementById('localFields');
    const btnHotel = document.getElementById('btnHotel');
    const btnLocal = document.getElementById('btnLocal');
    
    if(type === 'hotel') {
        if (hotelFields) hotelFields.style.display = 'block';
        if (localFields) localFields.style.display = 'none';
        if (btnHotel) btnHotel.classList.add('active');
        if (btnLocal) btnLocal.classList.remove('active');
    } else {
        if (hotelFields) hotelFields.style.display = 'none';
        if (localFields) localFields.style.display = 'block';
        if (btnHotel) btnHotel.classList.remove('active');
        if (btnLocal) btnLocal.classList.add('active');
    }
}

function checkRegistration() {
    if(!window.cart.length) return;
    
    const name = localStorage.getItem('order_name');
    const phone = localStorage.getItem('local_phone');
    if (!name || !phone) {
        if (typeof toggleDrawer === 'function') toggleDrawer('regDrawerStep1');
    } else {
        if (typeof toggleDrawer === 'function') toggleDrawer('confirmDrawer');
    }
}

function goToStep1() {
    if (typeof toggleDrawer === 'function') toggleDrawer('regDrawerStep1');
}

function goToStep2() {
    const nameInput = document.getElementById('regName');
    const phoneInput = document.getElementById('regPhone');
    const name = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    
    if(!name || !phone) {
        if (typeof showModal === 'function') {
            return showModal("Required Info", "Please enter both your Full Name and Contact Number.");
        }
        return;
    }
    
    // Save to localStorage immediately so selectArea can use it
    localStorage.setItem('order_name', name);
    localStorage.setItem('local_phone', phone);
    
    if (typeof toggleDrawer === 'function') toggleDrawer('regDrawerStep2');
}

function goToStep3() {
    if (typeof toggleDrawer === 'function') toggleDrawer('regDrawerStep3');
}

function selectArea(area) {
    const name = localStorage.getItem('order_name') || '';
    const phone = localStorage.getItem('local_phone') || '';
    
    localStorage.setItem('order_type', 'online');
    localStorage.setItem('local_area', area);
    // Since we narrow it down to the area, specific landmark is not required
    localStorage.setItem('local_landmark', 'Not required - ' + area);
    
    const confirmMsg = document.getElementById('confirmMsg');
    const confirmSubMsg = document.getElementById('confirmSubMsg');
    if (confirmMsg) confirmMsg.innerText = "Ready to confirm your delivery order?";
    if (confirmSubMsg) confirmSubMsg.innerText = `Our delivery partner will bring it to your doorstep in ${area}.`;
    
    if (typeof toggleDrawer === 'function') toggleDrawer('confirmDrawer');
}

function selectSomewhereElse() {
    const name = localStorage.getItem('order_name') || '';
    const phone = localStorage.getItem('local_phone') || '';
    
    localStorage.setItem('local_area', 'Somewhere Else');
    localStorage.setItem('local_landmark', 'Somewhere Else');
    
    // Save cart and order details in local storage keys for other apps to consume
    localStorage.setItem('pariwarik_cart', JSON.stringify(window.cart));
    
    const totalEl = document.getElementById('mainTotal');
    const totalVal = totalEl ? parseFloat(totalEl.innerText) : 0;
    localStorage.setItem('pariwarik_total', totalVal);
    
    const orderData = {
        customerName: name,
        phone: phone,
        area: 'Somewhere Else',
        items: window.cart,
        totalPrice: totalVal,
        timestamp: new Date().toISOString()
    };
    
    localStorage.setItem('pariwarik_order', JSON.stringify(orderData));
    localStorage.setItem('order_info', JSON.stringify(orderData));
    
    redirectToPartner();
}

function redirectToPartner() {
    window.location.href = "http://bb.success0.com.np/";
}

function saveReg() {
    const nameInput = document.getElementById('regName');
    const phoneInput = document.getElementById('regPhone');
    const landmarkInput = document.getElementById('regLandmark');
    
    const name = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const landmark = landmarkInput ? landmarkInput.value.trim() : '';

    if(!name || !phone) {
        if (typeof showModal === 'function') showModal("Required Info", "Please enter your name and phone number.");
        return;
    }
    if(!landmark) {
        if (typeof showModal === 'function') showModal("Required Info", "Please enter your nearest landmark.");
        return;
    }
    
    localStorage.setItem('order_name', name);
    localStorage.setItem('order_type', 'online');
    localStorage.setItem('local_phone', phone);
    localStorage.setItem('local_area', 'Bharatpur 10');
    localStorage.setItem('local_landmark', landmark);

    const confirmMsg = document.getElementById('confirmMsg');
    const confirmSubMsg = document.getElementById('confirmSubMsg');
    if (confirmMsg) confirmMsg.innerText = "Ready to confirm your delivery order?";
    if (confirmSubMsg) confirmSubMsg.innerText = "Our delivery partner will bring it to your doorstep.";
    
    if (typeof toggleDrawer === 'function') toggleDrawer('confirmDrawer');
}

function finalizeOrder() {
    const auth = firebase.auth();
    const user = auth.currentUser;
    
    console.log("Attempting to finalize order. Current user:", user ? user.uid : "None");

    if(!user) {
        if (typeof showModal === 'function') {
            showModal("Connection Lost", "Authenticating with server, please wait...", "info");
        }
        auth.signInAnonymously()
            .then((u) => {
                console.log("Re-auth success:", u.user.uid);
                if (typeof showModal === 'function') {
                    showModal("Connected", "You are now connected. Please click 'Place Order Now' again.", "success");
                }
            })
            .catch(err => {
                console.error("Auth Fail:", err.code, err.message);
                if (typeof showModal === 'function') {
                    showModal("Connection Error", "Error: " + err.message);
                }
            });
        return;
    }
    
    const type = localStorage.getItem('order_type');
    const totalEl = document.getElementById('mainTotal');
    const totalVal = totalEl ? parseFloat(totalEl.innerText) : 0;
    
    const order = { 
        customerName: localStorage.getItem('order_name'), 
        orderType: type,
        device: navigator.userAgent,
        items: window.cart, 
        totalPrice: totalVal, 
        status: 'Ordered', 
        timestamp: new Date().toISOString() 
    };

    if(type === 'hotel') {
        order.roomNumber = localStorage.getItem('hotel_room');
    } else {
        order.phone = localStorage.getItem('local_phone');
        order.area = localStorage.getItem('local_area');
        order.landmark = localStorage.getItem('local_landmark');
        order.distance = localStorage.getItem('local_distance');
    }
    
    const path = type === 'hotel' ? `orders/hotel/${user.uid}` : `orders/online/${user.uid}`;
    
    firebase.database().ref(path).push(order).then(() => {
        if (typeof showModal === 'function') {
            showModal("Order Successful", "Your order has been sent to our kitchen. We will contact you shortly!", "success"); 
        }
        window.cart = [ ]; 
        if (typeof updateCartUI === 'function') updateCartUI(); 
        if (typeof renderItems === 'function') renderItems(); 
        if (typeof closeAll === 'function') closeAll();
    }).catch(e => {
        console.error(e);
        if (typeof showModal === 'function') {
            showModal("Order Failed", "Could not place order. Please check your connection and try again.");
        }
    });
}

// Bind to window for global exposure
window.checkRegistration = checkRegistration;
window.saveReg = saveReg;
window.goToStep1 = goToStep1;
window.goToStep2 = goToStep2;
window.goToStep3 = goToStep3;
window.selectArea = selectArea;
window.selectSomewhereElse = selectSomewhereElse;
window.redirectToPartner = redirectToPartner;
window.finalizeOrder = finalizeOrder;
window.setOrderType = setOrderType;
