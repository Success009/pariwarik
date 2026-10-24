# Pariwarik System Architecture & AI Agent Execution Specification

> **DIRECTIVE FOR AI AGENTS (Google Antigravity, Gemini, BigFish, Cursor, Claude Code):**  
> You are operating on the **authoritative Pariwarik repository**: `https://github.com/Success009/pariwarik`.  
> Read this document completely before touching any files. You must respect sector boundaries, run automated integrity tests, work strictly on isolated feature branches, and submit Pull Requests for review.

---

## 1. Ground Rules & Setup for the Agent

### Step 1: Abandon Stale Forks & Pull Fresh from Upstream
If you were previously working in another fork or stale repository (e.g., `1lyrahul/pari_warik`), **abandon that directory**.  
Clone or fetch directly from the official upstream repository:
```bash
git clone https://github.com/Success009/pariwarik.git
cd pariwarik
git checkout main
git pull origin main
```

### Step 2: Work on a Feature Branch (Main is Protected)
The `main` branch is protected by repository rules. Any direct push to `main` will be rejected by GitHub.  
You must always work in an isolated feature branch:
```bash
git checkout -b feature/<descriptive-name>
```

---

## 2. Application Sector Map & Isolation Boundaries

This application is divided into independent, decoupled sectors. **A change in one sector must NEVER break or contaminate other sectors.**

```
                                [ Pariwarik Codebase ]
                                           │
         ┌──────────────────┬──────────────┴───────────────┬──────────────────┐
         │                  │                              │                  │
    [Sector 1]         [Sector 2]                     [Sector 3]         [Sector 4]
   Landing Page       Online Menu                   In-House Menu      Admin & Staff
  (Accommodations)    (Customer Web App)             (Room/Table)     (Management Hub)
   /index.html         /menu/                         /local/           /menu/admin/
         │                  │                              │                  │
         └──────────────────┼──────────────────────────────┴──────────────────┘
                            │
                       [Sector 5]
              Shared Multi-Tenant RTDB
             (deep-freehold-389006)
            * NEVER touch /school or /bb_* *
                            │
                       [Sector 6]
              Automated Testing Suite
             (menu/tests/validate_menu.js)
```

---

### Sector 1: Hotel Accommodations & Landing Page (`/` Root)
- **Path**: `index.html`, `style.css`, `script.js`, `images/`
- **Scope**: Hotel branding, room booking inquiries, lodging amenities, location map, and contact channels.
- **Isolation Rule**: Completely decoupled from dining ordering logic. Never import menu scripts or modify menu Firebase listeners inside the landing page sector.

### Sector 2: Customer Online Dining & Delivery Menu (`/menu`)
- **Path**: `menu/index.html`, `menu/menu.css`, `menu/menu.js`, `menu/css/`, `menu/js/`
  - `menu/js/menu-core.js` & `menu/css/menu-core.css`: Catalog rendering, search, category swiping navigation, anonymous Firebase auth.
  - `menu/js/cart.js` & `menu/css/cart.css`: Cart mutations, item counter badges, and checkout drawer.
  - `menu/js/order-flow.js` & `menu/css/order-flow.css`: Customer contact form, delivery area selector (`Chaubiskothi Area`, `CMC Area`, `Somewhere Else`), and partner app handoff.
- **Isolation Rule**:
  - Uses modular CSS/JS files.
  - Delivery contracts must be preserved: Key `pariwarik_order` and `pariwarik_cart` in `localStorage` are parsed by the external partner app (**Bharatpur Bazar**) when "Somewhere Else" is selected. Never change these key names.

### Sector 3: In-House Dining & Room Service Menu (`/local`)
- **Path**: `local/index.html`, `local/menu.css`, `local/menu.js`
- **Scope**: Internal dining interface for seated dining and hotel room service orders.
- **Isolation Rule**:
  - Standalone single-bundle architecture (`local/menu.js` + `local/menu.css`).
  - When introducing global UI features (e.g. category pills, search behaviors), synchronize them between Sector 2 (`menu/`) and Sector 3 (`local/`) while preserving their distinct checkout flows.

### Sector 4: Staff Operations & Admin Portal (`/menu/admin`)
- **Path**: `menu/admin/`
  - `Dashboard.html` & `dashboard.js`: Live metrics, revenue calculations, active order monitoring, discount logs.
  - `StaffOrder.html` & `orders.js`: Active incoming orders management.
  - `StaffManualOrder.html` & `manual-order.js`: Table/room walk-in manual order placement.
  - `StaffCredits.html` & `credits.js`: Customer credit ledger and repayment settlements.
  - `StaffMenu.html` & `menu.js`: Live catalog pricing updates and in/out-of-stock toggles.
  - `StaffUpload.html` & `upload.js`: New dish creation with image uploads.
- **Isolation Rule**: Admin operations require staff authentication. Changes to customer menus in Sector 2 or 3 must NEVER break schema compatibility with the Admin order cards.

### Sector 5: Multi-Tenant Database Boundary (`database.rules.json`)
- **Database**: Firebase Realtime Database `deep-freehold-389006`
- **CRITICAL MULTI-TENANT ISOLATION RULES**:
  - This single database instance is shared across three independent projects:
    1. **Udayashree School App** (`/school`)
    2. **Bharatpur Bazar App** (`/bb_orders`, `/bb_users`, `/bb_*`)
    3. **Pariwarik Hotel App** (`/menu`, `/orders`, `/users`, `/admins`, `/totalorders`, `/credits`)
  - **STRICT PROHIBITION**: AI Agents are strictly forbidden from modifying, querying, deleting, or altering rules for `/school` or any `/bb_*` paths. Only touch `/menu`, `/orders`, `/users`, `/admins`, `/totalorders`, or `/credits`.

### Sector 6: Automated Testing & Verification (`menu/tests`)
- **Test Runner**: `menu/tests/validate_menu.js`
- **Scope**: Structural integrity, script inclusion checks, JavaScript syntax verification, delivery location handler validation.
- **Execution**:
  ```bash
  node menu/tests/validate_menu.js
  ```
- **Rule**: All tests MUST pass before pushing changes.

---

## 3. Strict Coding & Asset Rules

1. **Asset Cache Busting**:
   Whenever you edit any CSS or JS file, you MUST bump the cache-busting query parameter in `menu/index.html` and `local/index.html`:
   ```html
   <!-- Example: Incrementing version tag -->
   <link rel="stylesheet" href="menu.css?v=4.2">
   <script src="js/menu-core.js?v=4.2"></script>
   ```

2. **Image Hierarchy & Rendering**:
   - Always load food dish images using `getItemImageUrl(item.name)`.
   - Ensure the image layer sits cleanly in front of the placeholder icon:
     * `.img-container img` MUST have `z-index: 1;`
     * `.img-fallback` MUST have `z-index: 0;`

3. **No Unauthenticated DB Calls**:
   Anonymous Firebase authentication must succeed before any database query is dispatched.

---

## 4. End-to-End Pull Request Workflow for the Agent

When a feature or bug fix is requested:

```bash
# 1. Ensure you are on a fresh feature branch from latest main
git checkout main
git pull origin main
git checkout -b feature/<feature-name>

# 2. Make changes strictly within the assigned Sector
# (Apply cache buster bumps if CSS/JS changed)

# 3. Validate syntax across all JS files
for f in $(find . -name "*.js" -not -path "*/node_modules/*"); do node -c "$f"; done

# 4. Run the automated integrity test suite
node menu/tests/validate_menu.js

# 5. Commit with a concise summary
git add .
git commit -m "Implement <feature-name> in Sector X"

# 6. Push the feature branch to origin
git push -u origin feature/<feature-name>

# 7. Create a Pull Request targeting 'main'
# The owner (@Success009) will review the PR, test it, and merge it with 1 click.
```
