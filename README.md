# Pariwarik Application Platform Documentation

Welcome to the **Pariwarik** codebase. This repository contains the public-facing landing page, booking system, and local dining menu application for **Pariwarik Hotel (Restaurant & Lodge)** located in Bharatpur-10, Chitwan, Nepal.

> [!IMPORTANT]
> **ATTENTION AGENTS AND DEVELOPERS:** 
> Before writing any code or making modifications to this repository, you must read the source code thoroughly. Ensure you understand the shared dependencies and database configurations to prevent breaking existing features in production.

---

## Table of Contents
1. [Core Repository Structure](#core-repository-structure)
2. [Database Security Rules](#database-security-rules)
3. [The Dining Menu Web Application (`/menu`)](#the-dining-menu-web-application-menu)
4. [Instructions for AI Agents](#instructions-for-ai-agents)
5. [Local Development and Testing](#local-development-and-testing)

---

## Core Repository Structure

The project is structured as a collection of static web pages and modules, backed by Firebase services:

*   [`/index.html`](file:///C:/Users/rahul/Desktop/pariwarik/index.html): The main hotel landing page showcasing accommodations, lodging amenities, dynamic scroll animations, and bookable stay options.
*   [`/style.css`](file:///C:/Users/rahul/Desktop/pariwarik/style.css): Vanilla CSS styling stylesheet for the core landing page.
*   [`/script.js`](file:///C:/Users/rahul/Desktop/pariwarik/script.js): General UI behavior for the main page (navbar collapse, smooth scrolling, etc.).
*   [`/menu/`](file:///C:/Users/rahul/Desktop/pariwarik/menu/): The main dining menu application for digital food ordering.
*   [`/local/`](file:///C:/Users/rahul/Desktop/pariwarik/local/): Local modules or assets folder.
*   [`/plan/`](file:///C:/Users/rahul/Desktop/pariwarik/plan/): Planning materials or mockups.
*   [`/database.rules.json`](file:///C:/Users/rahul/Desktop/pariwarik/database.rules.json): Realtime Database security rules configuration.
*   [`/firebase.json`](file:///C:/Users/rahul/Desktop/pariwarik/firebase.json): Firebase CLI configuration.

---

## Database Security Rules

The application shares a Firebase Realtime Database (RTDB) instance (`deep-freehold-389006`) with several other apps. The rules are saved locally in [`database.rules.json`](file:///C:/Users/rahul/Desktop/pariwarik/database.rules.json).

> [!WARNING]
> Do NOT modify the security rules of other systems. The database rules secure:
> 1. **Udayashree School App** (`/school`)
> 2. **Bharatpur Bazar App** (`/bb_orders`, `/bb_users`, `/bb_userMessages`, `/bb_adminMessages`)
> 3. **Pariwarik Dining Menu App** (`/menu`, `/orders/hotel`, `/orders/online`, `/users`, `/admins`)
> Ensure you preserve all existing rules to maintain operational integrity.

---

## The Dining Menu Web Application (`/menu`)

The program inside `/menu` is responsible for showing hotel food items, processing cart selections, and executing customer order submissions.

### Modular Architecture

To improve maintenance, the application code has been divided into modular CSS and JS scripts:

```
menu/
├── index.html         # Dining menu markup and drawer views
├── menu.css           # CSS entry-point (imports sub-stylesheets)
├── menu.js            # JS entry-point (preserves backward compatibility)
├── css/
│   ├── menu-core.css  # Typography, skeleton loading, product grid, and modals
│   ├── cart.css       # Bottom action bar and drawer-based shopping cart list
│   └── order-flow.css # Form inputs, custom area selectors, and checkout buttons
├── js/
│   ├── menu-core.js   # Firebase config, anonymous auth, DB listeners, search, and catalog rendering
│   ├── cart.js        # Cart items adding/updating and drawer toggling
│   └── order-flow.js  # Area check step, local storage synchronization, and order submissions
└── tests/
    └── validate_menu.js # Automated testing suite validating structural integrity
```

### The Delivery Location Flow

The checkout flow features a streamlined delivery area selection:
1. **Name & Contact Number**: Collected in Step 1.
2. **Area Selection (Step 2)**: The user is presented with three distinct choices:
   * **Chaubiskothi Area** (Bharatpur-10): Skips specific landmark entry; directly forwards to confirmation drawer.
   * **CMC Area** (Bharatpur-10): Skips specific landmark entry; directly forwards to confirmation drawer.
   * **Somewhere Else**: Saves user profile and order items data, then redirects to the partner app (**Bharatpur Bazar**).
3. **Local Storage Synchronization**:
   * When redirected to *Bharatpur Bazar*, order metadata is saved to local storage under key `pariwarik_order` (and `order_info`) containing `customerName`, `phone`, `area` ('Somewhere Else'), and a JSON stringified `items` list so the partner app can parse and process the order.

---

## Instructions for AI Agents

To maintain the high standards of this codebase:
1. **Always Read First**: You must analyze the modular files in `menu/js/` and `menu/css/` to understand exactly how state changes propagate through `window.cart`.
2. **Do Not Poll**: Do not poll for task statuses in terminal shells. Let the system resume your execution reactive to completions.
3. **Aesthetic Compliance**: Keep designs clean, using curated color palettes (like HSL gradients) and smooth micro-animations. Avoid browser defaults.
4. **Update Documentation**: If you modify JS/CSS structures, variables, database nodes, or local storage keys, you are **strictly required to update this README file** before finishing your work.

---

## Local Development and Testing

### Testing Integrity
An automated node test runner is available. Execute the command below in your shell to verify file structural integrity and syntax validation:
```bash
node menu/tests/validate_menu.js
```

### Deploying Database Rules
To apply database changes securely:
```bash
firebase use deep-freehold-389006
firebase deploy --only database
```
