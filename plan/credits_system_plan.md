# Architecture & Implementation Plan: Customer Credit System (Revised)

This document outlines the detailed plan to design, construct, and integrate a **Customer Credit System** inside the Pariwarik Hotel's administration. The credit system is specifically built to track outstanding balances of regular, daily local dining customers.

---

## 1. Firebase Realtime Database Schema

Two new top-level nodes will be created under the database root to manage people and credit transactions:

### `/credits/people/${personId}`
Holds the profile and current outstanding balance of credit customers.
json
{
  "id": "generated_person_push_id",
  "name": "Customer Full Name",
  "phone": "98XXXXXXXX", // optional
  "remainingCredit": 1250.00, // current outstanding balance
  "createdAt": "2026-05-30T15:00:00.000Z"
}
### `/credits/transactions/${personId}/${transactionId}`
Logs chronological transactions (both additions of orders on credit and payments to settle up).
json
{
  "id": "generated_transaction_push_id",
  "type": "addition", // "addition" or "payment"
  "amount": 450.00, // monetary value
  "orderId": "order_id_ref", // optional (for additions)
  "items": [
    {
      "name": "Paneer Butter Masala",
      "qty": 1,
      "price": 320.00
    },
    {
      "name": "Plain Naan",
      "qty": 2,
      "price": 65.00
    }
  ], // optional (detailed items of the order)
  "timestamp": "2026-05-30T15:10:20.000Z",
  "note": "Food credit addition" // or "Payment received at counter"
}
---

## 2. Shared Global Database References

We will update the shared `commonRefs` object inside `menu/admin/admin-core.js` to ensure uniform availability across pages:
javascript
var commonRefs = {
    menu: commonDB.ref('menu'),
    orders: commonDB.ref('orders'),
    totalOrders: commonDB.ref('totalorders'),
    cancelledOrders: commonDB.ref('cancelled_orders'),
    importItems: commonDB.ref('import_items'),
    usageRecords: commonDB.ref('usage_records'),
    menuTransactions: commonDB.ref('menu_item_transactions'),
    settings: commonDB.ref('settings'),
    
    // NEW CREDITS REFS
    creditsPeople: commonDB.ref('credits/people'),
    creditsTransactions: commonDB.ref('credits/transactions')
};
We will also update the common navigation header generator `injectHeader` inside `admin-core.js` to add the **Credits** tab:
javascript
function injectHeader(activePage) {
    const headerHTML = `
    <header class="app-header">
        <div class="header-title">Admin Panel</div>
        <nav class="header-nav">
            ${activePage === 'Dashboard.html' ? `<a href="Dashboard.html" class="nav-link active"><i class="fas fa-chart-pie"></i> Dashboard</a>` : ''}
            <a href="StaffOrder.html" class="nav-link ${activePage === 'StaffOrder.html' ? 'active' : ''}"><i class="fas fa-concierge-bell"></i> Orders</a>
            <a href="StaffCredits.html" class="nav-link ${activePage === 'StaffCredits.html' ? 'active' : ''}"><i class="fas fa-credit-card"></i> Credits</a>
            <a href="StaffMenu.html" class="nav-link ${activePage === 'StaffMenu.html' ? 'active' : ''}"><i class="fas fa-book-open"></i> Menu</a>
            <a href="StaffUpload.html" class="nav-link ${activePage === 'StaffUpload.html' ? 'active' : ''}"><i class="fas fa-image"></i> Images</a>
            <a href="ImportProgram.html" class="nav-link ${activePage === 'ImportProgram.html' ? 'active' : ''}"><i class="fas fa-boxes"></i> Inventory</a>
            <a href="#" onclick="logout()" class="nav-link logout-btn"><i class="fas fa-sign-out-alt"></i> Logout</a>
        </nav>
    </header>`;
    document.body.insertAdjacentHTML('afterbegin', headerHTML);
}
---

## 3. Staff Order Management Integration (`StaffOrder.html` and `orders.js`)

The credit button will only be accessible for local accepted orders.

### UI Additions (`StaffOrder.html`)
1. **Dynamic "Add to Credit" Button:** Added in the card-footer for `local` orders whose status is `Accepted` (next to the "Complete" button).
2. **Credit Attachment Modal:** A custom modal containing:
   - Searchable select/dropdown to pick from existing credit customers.
   - Text input section "Create New Person" (Name and Phone) to support on-the-fly registration.
   - Action buttons: "Confirm Credit Completion" and "Cancel".

### Script Changes (`orders.js`)
1. **Loading Customers:** Fetch and cache people from `credits/people` in real-time on load to populate the modal select field.
2. **Modal Interaction:** 
   - Define `openCreditModal(orderId, userUid, totalPrice, items)` to record active order properties and open the UI element.
   - Define `closeCreditModal()` to clean up.
3. **Credit Processing Logic:**
   - On confirmation, if "New Person" details are entered, push a new profile node under `credits/people` and capture the resulting ID.
   - Execute a safe Firebase `transaction` to increase `/credits/people/${personId}/remainingCredit` by the order's total amount.
   - Log the transaction under `/credits/transactions/${personId}` of type `"addition"`.
   - Complete the order:
     - Push the order object with metadata flags `paymentType: "credit"` and `creditPersonId: personId` to the archive (`totalorders`).
     - Remove the order from `/orders/local/${userUid}/${orderId}` using standard completion methods.

---

## 4. Dedicated Credits Management Program (`StaffCredits.html` and `credits.js`)

A new, dedicated program that allows staff to manage credits, view transaction histories, add new profiles, and record payments.

### Page Design (`StaffCredits.html`)
- Structured with search & filter boxes.
- Displays cards for all credit profiles showing their current outstanding credit.
- Incorporates dynamic action buttons:
  - **"Pay / Settle"**: Opens a settlement dialog.
  - **"View Statement"**: Opens the customer ledger listing previous orders and payments.
  - **"Register Customer"**: Opens a form to create a credit account outside of an active order.

### Application Logic (`credits.js`)
- Listens to `/credits/people` and renders cards.
- Handles search/filtering of credit customer list.
- Implements `recordPayment(personId, payAmount)`:
  - Validates input.
  - Executes a transaction to subtract `payAmount` from `/credits/people/${personId}/remainingCredit`.
  - Pushes a `"payment"` transaction log under `/credits/transactions/${personId}`.
- Implements statement viewing to list transactions chronologically.

---

## 5. Financial Dashboard Integration (`Dashboard.html` and `dashboard.js`)

Integrates real-time credit tracking and realized cash/profit analysis for the owner.

### UI Additions (`Dashboard.html`)
1. **Remaining Credits Stat Card:** Added to the statistics grid to show overall uncollected credit.
   <div class="stat-card cost" style="background-color: rgba(155, 89, 182, 0.1); color: #8e44ad;">
       <div class="stat-label">Remaining Credits</div>
       <div class="stat-value" id="remainingCredits">Rs 0</div>
   </div>
   2. **Net Realized Profit Card:** Displays realized profit, which increases as outstanding credits are settled:
   <div class="stat-card profit" style="background-color: rgba(46, 204, 113, 0.15); color: var(--success);">
       <div class="stat-label">Net Cash Profit</div>
       <div class="stat-value" id="netProfit">Rs 0</div>
   </div>
   ### Script Changes (`dashboard.js`)
1. **Fetch Credits:** Include `credits/people` in the initial `fetchAllData` load sequence.
2. **Realized Metrics Calculation:**
   - **Total Sales Revenue** = sum of all orders in `totalorders`.
   - **Remaining Credits** = sum of all outstanding balances in `credits/people`.
   - **Realized Cash** = `Total Sales Revenue - Remaining Credits`.
   - **Net Profit** = `Realized Cash - Cost of Goods`.
   - Populate corresponding cards on-screen.
3. This guarantees that once a credit is paid, `Remaining Credits` decreases, increasing the `Realized Cash` and directly reflecting in `Net Profit` ("goes towards profit").

---

## 6. Summary of Architectural Advantages
- **No Third-Party DB Required:** Leverages existing Firebase Realtime Database structures and rules.
- **Dedicated Management Panel:** Keeps credit clearing decoupled from order processing via `StaffCredits.html`.
- **Immutable Transaction Records:** Retains a full financial paper trail, enabling reliable dispute resolution.
- **Accurate Financial Modeling:** Reflects credit settlements as realized cash profit in the core owner metrics.