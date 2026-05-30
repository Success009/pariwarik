// Credits Management Script
let allPeople = [ ];
let activePersonId = null;

// References
const peopleRef = commonRefs.creditsPeople;
const transactionsRef = commonRefs.creditsTransactions;

// Real-time listener to load accounts
function listenToPeople() {
    peopleRef.on('value', snap => {
        allPeople = [ ];
        if (snap.exists()) {
            snap.forEach(child => {
                const person = child.val();
                person.id = child.key;
                allPeople.push(person);
            });
        }
        renderPeople();
    });
}

// Render cards
function renderPeople() {
    const container = document.getElementById('creditsContainer');
    if (!container) return;

    const searchTerm = document.getElementById('searchBox').value.trim().toLowerCase();
    const filtered = allPeople.filter(p => {
        const matchesName = p.name && p.name.toLowerCase().includes(searchTerm);
        const matchesPhone = p.phone && p.phone.toLowerCase().includes(searchTerm);
        return matchesName || matchesPhone;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state"><h3>No Customer Accounts Found</h3><p>Try refining your search or register a new customer.</p></div>`;
        return;
    }

    container.innerHTML = filtered.map(p => {
        const balance = p.remainingCredit !== undefined ? p.remainingCredit : 0;
        return `
        <div class="credit-card" id="card-${p.id}">
            <div class="customer-info">
                <div class="customer-name">
                    <span>${p.name}</span>
                    <i class="fas fa-user-circle" style="color:var(--primary); font-size:1.4rem;"></i>
                </div>
                ${p.phone ? `<div class="customer-phone"><i class="fas fa-phone"></i> ${p.phone}</div>` : `<div class="customer-phone" style="opacity:0.5;"><i class="fas fa-phone-slash"></i> No phone added</div>`}
            </div>
            <div class="credit-balance">
                <span>Owed:</span> Rs ${balance.toFixed(2)}
            </div>
            <div class="card-actions">
                <button class="btn btn-success" onclick="openPaymentModal('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${balance})">
                    <i class="fas fa-hand-holding-usd"></i> Pay
                </button>
                <button class="btn btn-outline-primary" onclick="openStatementModal('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${balance})">
                    <i class="fas fa-file-invoice-dollar"></i> Ledger
                </button>
            </div>
        </div>`;
    }).join('');
}

// Register Customer Modal Functions
function openRegisterModal() {
    document.getElementById('regName').value = '';
    document.getElementById('regPhone').value = '';
    const m = document.getElementById('registerModal');
    m.style.display = 'flex';
    setTimeout(() => m.classList.add('active'), 10);
}

function closeRegisterModal() {
    const m = document.getElementById('registerModal');
    if (m) {
        m.classList.remove('active');
        setTimeout(() => m.style.display = 'none', 300);
    }
}

function registerCustomer() {
    const name = document.getElementById('regName').value.trim();
    const phone = document.getElementById('regPhone').value.trim();

    if (!name) {
        showToast('Full Name is required', 'error');
        return;
    }

    const newPerson = {
        name: name,
        phone: phone || null,
        remainingCredit: 0,
        createdAt: new Date().toISOString()
    };

    peopleRef.push(newPerson)
        .then(() => {
            showToast('Customer account registered successfully');
            closeRegisterModal();
        })
        .catch(err => {
            console.error(err);
            showToast('Error registering account', 'error');
        });
}

// Payment Modal Functions
function openPaymentModal(personId, name, balance) {
    activePersonId = personId;
    document.getElementById('payCustomerName').textContent = name;
    document.getElementById('payCustomerBalance').textContent = 'Rs ' + balance.toFixed(2);
    document.getElementById('payAmount').value = '';
    document.getElementById('payAmount').max = balance;
    document.getElementById('payNote').value = '';

    const m = document.getElementById('paymentModal');
    m.style.display = 'flex';
    setTimeout(() => m.classList.add('active'), 10);
}

function closePaymentModal() {
    const m = document.getElementById('paymentModal');
    if (m) {
        m.classList.remove('active');
        setTimeout(() => m.style.display = 'none', 300);
    }
}

function submitPayment() {
    const amountInput = document.getElementById('payAmount');
    const amount = parseFloat(amountInput.value);
    const note = document.getElementById('payNote').value.trim();

    if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid payment amount', 'error');
        return;
    }

    if (!activePersonId) return;

    // Deduct credit balance
    peopleRef.child(activePersonId).child('remainingCredit').transaction(current => {
        return Math.max(0, (current || 0) - amount);
    }, (error, committed) => {
        if (error) {
            console.error(error);
            showToast('Payment deduction failed', 'error');
            return;
        }

        if (committed) {
            // Log payment transaction
            const tx = {
                type: 'payment',
                amount: amount,
                timestamp: new Date().toISOString(),
                note: note || 'Cash payment at counter'
            };

            transactionsRef.child(activePersonId).push(tx)
                .then(() => {
                    showToast('Payment recorded successfully');
                    closePaymentModal();
                })
                .catch(err => {
                    console.error(err);
                    showToast('Error logging transaction', 'error');
                });
        }
    });
}

// Statement / Ledger Modal Functions
function openStatementModal(personId, name, balance) {
    document.getElementById('stmtCustomerName').textContent = name;
    document.getElementById('stmtOutstanding').textContent = 'Rs ' + balance.toFixed(2);
    
    const list = document.getElementById('stmtList');
    list.innerHTML = `<div style="text-align:center; padding:2rem; opacity:0.5;"><i class="fas fa-circle-notch fa-spin fa-2x"></i><p style="margin-top:5px;">Loading statement...</p></div>`;

    const m = document.getElementById('statementModal');
    m.style.display = 'flex';
    setTimeout(() => m.classList.add('active'), 10);

    // Fetch ledger entries once
    transactionsRef.child(personId).once('value', snap => {
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
            <li class="statement-item">
                <div class="tx-left">
                    <span class="tx-type ${t.type}">${t.type === 'addition' ? 'Owed' : 'Paid'}</span>
                    <span class="tx-date">${dateStr}</span>
                    <span class="tx-desc">${t.note || (t.type === 'addition' ? 'Food Order' : 'Settle Payment')}</span>
                    ${itemsHTML}
                </div>
                <div class="tx-amount ${t.type}">
                    ${t.type === 'addition' ? '+' : '-'} Rs ${t.amount.toFixed(2)}
                </div>
            </li>`;
        }).join('');
    }).catch(err => {
        console.error(err);
        list.innerHTML = `<li style="text-align:center; padding:2rem; color:var(--danger); border-bottom:none;">Error loading ledger</li>`;
    });
}

function closeStatementModal() {
    const m = document.getElementById('statementModal');
    if (m) {
        m.classList.remove('active');
        setTimeout(() => m.style.display = 'none', 300);
    }
}

// Listen to search events
document.addEventListener('DOMContentLoaded', () => {
    injectHeader('StaffCredits.html');
    listenToPeople();
    document.getElementById('searchBox').addEventListener('input', renderPeople);
});