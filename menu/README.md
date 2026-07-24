# Dining Menu Web Application

This directory contains the digital dining menu application for **Pariwarik Hotel**. Customers can browse delicacies, manage their selection in the cart, and submit hotel/delivery orders.

---

## Directory Index

*   [`index.html`](file:///C:/Users/rahul/Desktop/pariwarik/menu/index.html): Main page interface and sidebar sliding drawers for checkout steps.
*   [`menu.css`](file:///C:/Users/rahul/Desktop/pariwarik/menu/menu.css): Stylesheet entry point mapping imports to modular CSS files.
*   [`menu.js`](file:///C:/Users/rahul/Desktop/pariwarik/menu/menu.js): JS entry point implementing a backward-compatible dynamic script loader.
*   [`css/`](file:///C:/Users/rahul/Desktop/pariwarik/menu/css/): Modular styles split by function:
    *   [`menu-core.css`](file:///C:/Users/rahul/Desktop/pariwarik/menu/css/menu-core.css): Typography, loader, product grid, card layouts, and modal windows.
    *   [`cart.css`](file:///C:/Users/rahul/Desktop/pariwarik/menu/css/cart.css): Floating bottom order bar and drawer shopping basket row styling.
    *   [`order-flow.css`](file:///C:/Users/rahul/Desktop/pariwarik/menu/css/order-flow.css): Text inputs, final confirm button, and custom location selectors.
*   [`js/`](file:///C:/Users/rahul/Desktop/pariwarik/menu/js/): Modular logic components:
    *   [`menu-core.js`](file:///C:/Users/rahul/Desktop/pariwarik/menu/js/menu-core.js): Firebase setup, anonymous login, database catalog listeners, search, and menu card rendering.
    *   [`cart.js`](file:///C:/Users/rahul/Desktop/pariwarik/menu/js/cart.js): Cart object mutation and slide drawer toggles.
    *   [`order-flow.js`](file:///C:/Users/rahul/Desktop/pariwarik/menu/js/order-flow.js): Delivery details validation, custom area processing, local storage sync, and database order uploads.
*   [`tests/`](file:///C:/Users/rahul/Desktop/pariwarik/menu/tests/): Automated test scripts:
    *   [`validate_menu.js`](file:///C:/Users/rahul/Desktop/pariwarik/menu/tests/validate_menu.js): Checks integrity of code files, script inclusion tags, and area checkout logic.

---

## Checkout and Delivery Flow Details

When a customer completes their order:
1. **Details Form**: The user inputs their Name and Phone number.
2. **Select your area**:
   * If they choose **Chaubiskothi Area** or **CMC Area**, the system skips landmark input (reducing friction since the delivery area is narrow enough) and saves profile and location properties directly, redirecting to the final confirmation drawer.
   * If they choose **Somewhere Else**, the system saves the customer's profile details and stringified cart items into local storage and redirects the browser to the **Bharatpur Bazar** partner app.
3. **Local Storage Contract**:
   * Key `pariwarik_order` (and its alias `order_info`) contains:
     ```json
     {
       "customerName": "John Doe",
       "phone": "98XXXXXXXX",
       "area": "Somewhere Else",
       "items": [...],
       "totalPrice": 1230.00,
       "timestamp": "2026-06-15T..."
     }
     ```
   * Key `pariwarik_cart` contains the JSON list of items in the cart.
   * Key `pariwarik_total` contains the order total amount.

---

## Instructions for AI Agents and Modifiers
1. **Read Before Editing**: Read all JS module files in `js/` to verify function names and signatures.
2. **Test Changes**: Always execute `node tests/validate_menu.js` before checking in code.
3. **Update Documentation**: If you alter checkout logic, local storage key contracts, or file mappings, you must update this `README.md` and the root `README.md`.
