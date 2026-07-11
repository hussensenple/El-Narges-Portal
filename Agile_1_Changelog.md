# Agile 1: Admin Portal Roles - Changelog

This document records the step-by-step progress and updates made during the implementation of Agile 1.

---

## 🛠️ Step 1: Database Models Update (Completed)
**Date:** July 10, 2026

* **Created `BrokerProfile` Schema:** Added to store the `manualId` assigned by the Admin.
* **Created `EngineerProfile` Schema:** Added to store `manualId`, `age`, `speciality`, and `graduationYear`.
* **Created `AdminProfile` Schema:** Added to store `manualId` and `age`.
* **Updated `User` Schema:** Expanded the `role` enum to include `['user', 'owner', 'broker', 'engineer', 'admin']` (added `engineer`).

---

## 🛠️ Step 2: Backend API Routes & Controllers (Completed)
**Date:** July 10, 2026

* **Created `rolesController.js`:** 
  * Handled `getUsersByRole` logic to fetch users with their specific profiles attached.
  * Handled `changeUserRole` logic to automatically create profile collections (`BrokerProfile`, `EngineerProfile`, `AdminProfile`) when upgrading, and handle cleanup when downgrading a user back to a standard `user`.
  * Handled `editUserInfo` logic for editing standard info + role-specific manual IDs.
* **Created `rolesRoutes.js`:** Connected 5 endpoints for the roles widget.
* **Updated `server.js`:** Registered the new `/api/roles` endpoint router.

---

## 🛠️ Step 3: Frontend Roles Widget Scaffolding (Completed)
**Date:** July 10, 2026

* **Updated `AdminRequests.tsx`:** Added the "👥 Roles Management" tab to the admin navigation bar.
* **Created `RolesWidget.tsx`:** Built the main layout wrapper managing state for the 5 sub-tabs (Users, Owners, Brokers, Engineers, Admins).
* **Created 5 Dedicated Table Components:**
  * `UsersTable.tsx`: Live data fetching, phone search.
  * `OwnersTable.tsx`: Displays owned properties count, phone search.
  * `BrokersTable.tsx`: Displays Manual Broker ID, manual ID search.
  * `EngineersTable.tsx`: Displays Speciality, Age, Grad Year, manual ID search.
  * `AdminsTable.tsx`: Displays Age, manual ID search.

---

## 🛠️ Step 4: Modals & Property Assignment Flow (Completed)
**Date:** July 10, 2026

* **Implemented real `assignProperty` logic in `rolesController.js`:**
  * Owner assignment: sets `ownerId` on Unit, adds to user's `ownedUnits`, ensures role stays `owner`.
  * Broker assignment: sets `brokerId` on Unit without changing property status.
* **Implemented real `removeProperty` logic in `rolesController.js`:**
  * Owner removal: clears `ownerId`, reverts ArcGIS status to Available (1), auto-downgrades user to `user` if no properties remain.
  * Broker removal: clears `brokerId`, making unit available for other brokers.
* **Added `getAdminCatalog` endpoint (`GET /api/roles/catalog?mode=owner|broker`):**
  * Queries ArcGIS Feature Servers for Available (+ Interested for broker mode) properties.
  * Filters out broker-assigned units from MongoDB in broker mode.
* **Built full `PropertyAssignCatalog.tsx` component:**
  * Fetches live GIS data and renders property cards.
  * Broker mode: Units are grouped by `BuildingID_FK` header.
  * Owner mode: Flat grid of Available units/villas.
  * Search bar by Property ID / Building ID.
  * "+ Assign" button triggers the backend API.
* **Updated `RoleChangeModal.tsx`:**
  * After saving Owner or Broker role, automatically transitions to `PropertyAssignCatalog` (no alert, seamless flow).
  * Submit button text changes to "Save & Assign Property →" for Owner/Broker roles.
  * Catalog has a "Smart Close" button — it requires at least 1 property to be assigned before saving the role, and prompts the user if they try to exit prematurely.

---

## 🛠️ Step 5: Edit User Modals (Completed)
**Date:** July 10, 2026

* **Added backend support for property management:**
  * Created `getUserUnits` API (`GET /api/roles/user-units/:userId?role=owner|broker`) to fetch assigned properties for the modal.
* **Built dynamic `EditUserModal.tsx` component:**
  * Adjusts fields dynamically based on user role (e.g., standard fields for all, Age/Speciality for Engineers, Manual ID for Admins).
  * Has a two-pane layout for Owners/Brokers:
    * Left side: Standard form fields.
    * Right side: List of currently assigned properties with a "Remove" button.
  * Includes an "+ Add" button that opens `PropertyAssignCatalog` seamlessly to assign more units.
  * Handles edge case: If an owner's last property is removed, the modal alerts the admin, auto-closes, and downgrades the user.
* **Wired Edit functionality across the portal:**
  * Attached `EditUserModal` to `UsersTable`, `OwnersTable`, `BrokersTable`, `EngineersTable`, and `AdminsTable`.
  * The "✏️ Edit" / "✏️ Edit & Manage" buttons now open this modal and auto-refresh the tables on save/close.

---

## 🛠️ Step 6: User Deletion Flow (Completed)
**Date:** July 10, 2026

* **Backend Update:**
  * Created `deleteUser` API (`DELETE /api/roles/:userId`) in `rolesController.js` and wired it in `rolesRoutes.js`.
  * The API handles safely wiping the user's profile and unassigning properties/clearing `ownerId`/`brokerId` based on their role before deleting their core account.
* **Frontend Update:**
  * Added a **"🗑️ Delete"** button to the `UsersTable.tsx`.
  * Implemented a browser confirmation prompt before permanently deleting the user.

---

## 🛠️ Step 7: Bug Fixes & Data Correction (Completed)
**Date:** July 11, 2026

* **Backend Update (`bookingController.js`):**
  * Fixed a bug where `sourceLayer` was not being saved when converting an approved Booking Request into a sold Unit.
  * Ensures that Villas are properly flagged as `Villas_Global` and not mistakenly rendered as `Apartment` in the Admin Dashboard.
* **Database Correction (`fix_user_data.js`):**
  * Manually patched corrupted unit records for an owner where `ownerId` was null despite being in the user's `ownedUnits` array.
  * Corrected missing `sourceLayer` on a purchased Villa to ensure proper rendering across the Admin Portal.

---

## 🛠️ Step 8: Frontend Polishing & Real-time Sync Fixes (Completed)
**Date:** July 11, 2026

* **Map Widgets Optimization & UI Improvements:**
  * Re-organized widget placement on the map (Login top-right, MyUnits below it, Weather at top-left, Fullscreen at bottom-right) and adjusted sizes.
  * Added a close (X) button to the `BuildingSidebar` and adjusted its height to prevent overlapping with other widgets.
  * Greatly optimized `BuildingSidebar` loading speed by querying only the 5 units of the clicked building directly from ArcGIS, instead of downloading the entire catalog.
  * Added "🔖 Book Now" buttons inside the `BuildingSidebar` exclusively for available apartments.
* **3D Map Zoom functionality Fixed:**
  * Fixed `UnitCatalog.tsx` "Zoom to" button which was broken for SceneLayers. Migrated from `queryFeatures` to `queryExtent` combined with `highlight` by object IDs to accurately zoom and highlight Villas and Buildings.
  * Fixed the Reset button in `UnitCatalog.tsx` to properly clear default ArcGIS popup selections using `view.popup.close()`.
* **ArcGIS Bidirectional Sync & Cache Bypass:**
  * Upgraded `checkAndUpdateBuildingCompleteness` in `arcgisService.js` to not only mark buildings as "Sold", but also revert them to "Available" if a unit's sale is cancelled.
  * Fixed a race condition/indexing delay in AGOL: Forced the local node script to forcefully override the recently changed unit's status in memory before evaluating `allSold`, ensuring the backend does not rely on stale AGOL cached responses.
* **Premium Popups & Dynamic Actions:**
  * Completely redesigned the `Villas_Global` Popup Template into a stunning, premium dark-mode card with dynamic status colors, gradients, and a prominent "View Full Design" button.
  * Added a dynamic "🔖 Book Now" popup action button for Villas that only appears if the Villa is Available. 
  * Wrote custom CSS in `index.css` to style the native ArcGIS popup action buttons to look like modern gradient UI elements.
  * Fixed an authentication bug during Villa booking caused by a stale closure by reading user session directly from `localStorage`.
  * Fixed a bug where popup actions (like the "Book Now" button) persisted when clicking on Buildings by explicitly resetting `view.popup.actions` for non-villa layers.
