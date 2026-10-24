# AGENT PROTOCOL & SECTOR ARCHITECTURE SPECIFICATION

> **AGENT INGESTION NOTICE:**  
> This file is the primary system operating directive for autonomous coding agents (Google Antigravity, Gemini CLI, BigFish CLI, Cursor, Claude Code) working on this codebase.  
> Read and execute the protocols below strictly in order.

---

## PROTOCOL 1: ENVIRONMENT & UPSTREAM SYNCHRONIZATION (MANDATORY)

Before inspecting code or accepting user tasks, you must ensure you are not operating on a stale fork or detached branch:

1. **Abandon Stale Clones / Forks**: If you are in a fork (such as `1lyrahul/pari_warik`) or an out-of-sync local tree, abandon that state immediately.
2. **Sync from Official Upstream**:
   ```bash
   git remote set-url origin https://github.com/Success009/pariwarik.git 2>/dev/null || git clone https://github.com/Success009/pariwarik.git
   git fetch origin main
   git checkout main
   git pull origin main
   ```
3. **Mandatory Feature Branch Creation**:
   The `main` branch has branch protection enabled. You are **strictly forbidden from committing or pushing directly to `main`**.
   You must immediately branch off:
   ```bash
   git checkout -b feature/<task-or-feature-name>
   ```

---

## PROTOCOL 2: APPLICATION SECTOR ISOLATION MATRIX

The codebase is partitioned into distinct, decoupled operational sectors.  
**RULE OF SECTOR ENCAPSULATION**: When the user requests a feature or modification, you must determine which sector it belongs to. Modify **ONLY** files inside that target sector. Do **NOT** bleed changes, mutate shared globals, or edit files in unrelated sectors.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PARIWARIK APPLICATION SECTOR MAP                      │
├────────────────────┬────────────────────┬─────────────────┬─────────────────┤
│ SECTOR 1           │ SECTOR 2           │ SECTOR 3        │ SECTOR 4        │
│ Landing Page       │ Online Menu (Web)  │ In-House Menu   │ Staff & Admin   │
│ Path: /            │ Path: /menu/       │ Path: /local/   │ Path: /menu/admin│
├────────────────────┴────────────────────┴─────────────────┴─────────────────┤
│ SECTOR 5: Shared Multi-Tenant Database (Path: database.rules.json)          │
│ * Multi-app RTDB (deep-freehold-389006). NEVER touch /school or /bb_* nodes! │
├─────────────────────────────────────────────────────────────────────────────┤
│ SECTOR 6: Automated Integrity Test Harness (Path: menu/tests/validate_menu.js│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Detailed Sector Boundaries:

- **Sector 1: Landing Page & Accommodations (`/`)**
  - **Targets**: `index.html`, `style.css`, `script.js`, `images/`
  - **Function**: Public hotel landing page, rooms, amenities, and contact information.
  - **Boundary**: Completely independent from dining/ordering logic. Do not import menu modules here.

- **Sector 2: Online Customer Dining & Delivery Menu (`/menu/`)**
  - **Targets**: `menu/index.html`, `menu/css/` (`menu-core.css`, `cart.css`, `order-flow.css`), `menu/js/` (`menu-core.js`, `cart.js`, `order-flow.js`)
  - **Function**: Customer ordering, category filter & swipe navigation, cart calculation, delivery area selection.
  - **Boundary**: Modular structure. Must maintain `localStorage` handoff keys (`pariwarik_order`, `pariwarik_cart`) for the external partner app (**Bharatpur Bazar**) when "Somewhere Else" is chosen.

- **Sector 3: In-House Dining / Room Service Menu (`/local/`)**
  - **Targets**: `local/index.html`, `local/menu.css`, `local/menu.js`
  - **Function**: Local table and room service ordering menu.
  - **Boundary**: Single-bundle architecture. If you introduce reusable menu UI components (e.g. category pills, search behaviors), synchronize them intentionally with Sector 2 while keeping the local ordering flow intact.

- **Sector 4: Staff Operations & Admin Portal (`/menu/admin/`)**
  - **Targets**: `Dashboard.html`, `StaffOrder.html`, `StaffManualOrder.html`, `StaffCredits.html`, `StaffMenu.html`, `StaffUpload.html`, `ImportProgram.html` and their respective `.js` scripts.
  - **Function**: Kitchen order fulfillment, billing discounts, table walk-in orders, inventory toggles, and customer credit settlements.
  - **Boundary**: Requires authentication. Never modify public order object shapes without ensuring admin dashboard parser compatibility.

- **Sector 5: Multi-Tenant Database Boundaries (`database.rules.json`)**
  - **Instance**: Firebase Realtime Database `deep-freehold-389006`
  - **STRICT PROHIBITION**: This database is multi-tenant and shared with:
    1. Udayashree School App (`/school`)
    2. Bharatpur Bazar App (`/bb_orders`, `/bb_users`, `/bb_*`)
    3. Pariwarik App (`/menu`, `/orders`, `/users`, `/admins`, `/totalorders`, `/credits`)
    **NEVER touch, query, modify, or delete database keys outside Pariwarik's designated paths.**

- **Sector 6: Automated Integrity Test Harness (`menu/tests/`)**
  - **Target**: `menu/tests/validate_menu.js`
  - **Function**: Validates structural file existence, JS syntax, script references, area selection handlers, and storage sync contracts.

---

## PROTOCOL 3: ASSET & RUNTIME INTEGRITY RULES

1. **Mandatory Cache-Busting**:
   Whenever you edit CSS or JS in Sector 2 or Sector 3, you **must increment the version query string in the respective HTML files** (`menu/index.html` and `local/index.html`), e.g. from `?v=4.1` to `?v=4.2`. Browsers aggressively cache these files.
2. **Image Hierarchy**:
   Food images must load through `getItemImageUrl(name)` with `.img-container img` styled at `z-index: 1;` and `.img-fallback` styled at `z-index: 0;`.
3. **Anonymous Auth First**:
   Always confirm Firebase anonymous auth has initialized before querying the Realtime Database.

---

## PROTOCOL 4: AUTOMATED VERIFICATION (TEST GATEWAY)

Before committing any files or opening a PR, you must run the local verification suite:

```bash
# 1. Structural and functional test runner
node menu/tests/validate_menu.js

# 2. Syntax verification across all scripts
for f in $(find . -name "*.js" -not -path "*/node_modules/*"); do node -c "$f"; done
```
*If any test fails or produces a syntax error, resolve it within the target sector before proceeding.*

---

## PROTOCOL 5: PUSH & PULL REQUEST DISPATCH

Once code is implemented and all tests pass:

1. **Commit Changes**:
   ```bash
   git add <modified-sector-files>
   git commit -m "Implement <feature-description> in Sector <X>"
   ```
2. **Push to Feature Branch**:
   ```bash
   git push -u origin feature/<task-or-feature-name>
   ```
3. **Dispatch Pull Request**:
   Create a Pull Request on GitHub targeting `main`.  
   Output the Pull Request URL clearly to the user.  
   The repository owner (`@Success009`) will review, verify the diff, and merge the branch into `main`.
