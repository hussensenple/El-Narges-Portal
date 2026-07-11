# El Narges Portal — Master System Prompt

Act as an Expert System Architect, Full-Stack MERN Developer, and Web GIS Engineer. This document describes the **complete, current state** of the "El Narges Portal" system — including all architecture decisions, data models, API contracts, and critical constraints established through Agile Sprint 1.

---

# 1. Project Overview

**"El Narges Portal"** is an interactive 3D Web GIS real estate platform that integrates real-time transactional data (MongoDB) with 3D spatial data (ArcGIS Feature Servers). It serves multiple user roles — Users, Owners, Brokers, Engineers, and Admins — and features an AI-powered Property Advisor, a full Admin Role Management Portal, and real-time dual-database synchronization.

---

# 2. Tech Stack

- **Frontend:** React.js (Vite), TypeScript, ArcGIS Maps SDK for JavaScript, Axios, React Router
- **Backend:** Node.js, Express.js, Socket.io, Mongoose/MongoDB
- **AI & APIs:** Google Gemini API (`@google/generative-ai`) for Agentic workflows, OpenWeatherMap API for live scene weather mapping, ArcGIS REST APIs (Feature Services & Network Analysis)
- **Database:** MongoDB (transactional logic & role management) + ArcGIS Online Feature Servers (spatial/3D map data)

---

# 3. System Architecture & Core Features

## A. Dual-Database Architecture (MongoDB + ArcGIS)

The system runs two databases in parallel:
- **MongoDB** holds all application logic: user accounts, roles, property ownership (`ownerId`, `brokerId`), booking requests, complaints, and broker profiles.
- **ArcGIS Online Feature Servers** hold the 3D spatial data (geometry, visual status colors, owner name/phone fields on map).

### The MongoDB `Units` Collection
This is the **critical bridge** between the two systems. A `Unit` document is created/updated in MongoDB whenever a property is assigned or a booking is approved. Fields:

| Field | Purpose |
|---|---|
| `arcgisId` | The ArcGIS OBJECTID (apartments) or GlobalID (villas) — used as the lookup key for all ArcGIS API calls |
| `objectId` | The numeric ArcGIS OBJECTID — used as the **display ID** shown to users (matches Property Catalog cards) |
| `globalId` | ArcGIS GlobalID (GUID string) |
| `sourceLayer` | `'Units'` for Apartments \| `'Villas_Global'` for Villas & TwinHouses — **CRITICAL** for routing ArcGIS update calls to the correct Feature Layer |
| `status` | `'1'` = Available, `'2'` = Interested, `'3'` = Reserved, `'4'` = Sold |
| `ownerId` | MongoDB ObjectId ref to `User` — set when property is assigned/sold to an owner |
| `brokerId` | MongoDB ObjectId ref to `User` — set when property is assigned to a broker |
| `ownerName`, `ownerEmail`, `ownerPhone` | Denormalized owner info for ArcGIS field display |
| `unitName` | Human-readable label (e.g., 'شقة', 'فيلا') |
| `strict: false` | Schema allows extra fields without rejection |

### ArcGIS Feature Layers
- **Apartments (Units table):** `https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WFL1/FeatureServer/37`
  - Uses `OBJECTID` (numeric) as primary key
  - Updated via `updateFeatures` REST endpoint
- **Villas & TwinHouses:** `https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Map_3D_Final_WSL3/FeatureServer/8`
  - Uses `GlobalID` (GUID string) as primary key
  - Updated via `applyEdits` REST endpoint with `useGlobalIds: true`
- **Buildings:** `Buildings_Global` layer — used for zoom-to navigation in the Property Catalog

### ArcGIS Status Codes
| Code | Meaning |
|---|---|
| `'1'` or `'Available'` | Available — shown as green on map |
| `'2'` or `'Interested'` | Interest submitted — client has sent a request |
| `'3'` or `'Reserved'` / `'Booked'` | Reserved — broker has a confirmed booking |
| `'4'` or `'Sold'` | Sold — assigned to an owner |

---

## B. User Roles & the `User` Model

The `User` model (MongoDB) has a `role` field. Valid roles: `'user'`, `'owner'`, `'broker'`, `'engineer'`, `'admin'`.

**Role Constraints (enforced by backend before role change):**
- A `user` can only be promoted to `owner` if they are assigned at least 1 property simultaneously.
- A `user` can only be promoted to `broker` / `engineer` / `admin` if they are assigned a manual ID.
- An `owner` is automatically downgraded to `user` if their last owned property is removed.
- `broker`, `engineer`, and `admin` roles each have a dedicated Profile document in their own collection.

**User Model fields:**
- `name`, `phone`, `email`, `password` (hashed)
- `role` (String, default `'user'`)
- `ownedUnits: [ObjectId]` — array of refs to `Unit` documents (for owners)

**Profile Models** (separate collections):
- `BrokerProfile`: `{ userId, manualId }`
- `EngineerProfile`: `{ userId, manualId, age, speciality, graduationYear }`
- `AdminProfile`: `{ userId, manualId, age }`

---

## C. Admin Role Management Portal (`/api/roles/`)

A complete CRUD portal built in Agile Sprint 1. All routes are prefixed `/api/roles/`.

### API Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/:role` | Get all users with a given role (`user`, `owner`, `broker`, `engineer`, `admin`) |
| `PUT` | `/change-role/:userId` | Change a user's role (creates/deletes profile documents automatically) |
| `PUT` | `/edit/:userId` | Edit user info and profile fields |
| `POST` | `/assign-property` | Assign a property to an owner or broker. Saves `ownerId`/`brokerId`, `sourceLayer`, and `objectId` to the Unit document. Also syncs ArcGIS to `Sold (4)` for owner assignments. |
| `POST` | `/remove-property` | Remove a property from an owner or broker. Reads `sourceLayer` from MongoDB (never trusts the client) to ensure the correct ArcGIS layer is updated. |
| `GET` | `/catalog?mode=` | Fetch available properties for the assignment UI. `mode=owner`: Available only. `mode=broker`: Available + Interested, not assigned to another broker. `mode=all`: All properties (for the User Map), with MongoDB `ownerId` overriding ArcGIS status to guarantee Sold = truly owned. |
| `GET` | `/user-units/:userId?role=` | Get all units assigned to a specific user (owner or broker) |
| `DELETE` | `/:userId` | Permanently delete a user with full cleanup of their profile and property assignments |

### Key Logic Rules
1. **`assign-property`** must always save `sourceLayer` (`'Units'` or `'Villas_Global'`) and `objectId` (numeric OBJECTID) to the MongoDB Unit. This is required for correct removal routing later.
2. **`remove-property`** must always look up the `sourceLayer` from MongoDB — never use the value passed from the client. This prevents Villas from having their ArcGIS status updated in the wrong layer.
3. **`catalog?mode=all`** is used by the public User Property Catalog. It forces `Status: '4'` on any unit where `ownerId != null` in MongoDB, overriding any stale ArcGIS data. This ensures perfect sync across all roles.
4. A `Unit` must have `ownerId` set (not just `ownerName`) to be treated as "Sold" by the system.

---

## D. Frontend Admin Portal Components

Located under `frontend/src/components/admin/`:

### Tables (one per role):
- `UsersTable.tsx` — Search by phone, Edit, Change Role, **Delete** (with confirmation)
- `OwnersTable.tsx` — Manage owners and their properties
- `BrokersTable.tsx` — Manage brokers and their assigned listings
- `EngineersTable.tsx` — Manage engineering staff
- `AdminsTable.tsx` — Manage admin accounts

### Modals:
- **`RoleChangeModal.tsx`** — Steps the admin through changing a user's role. Validates that an Owner has ≥1 property assigned, and that Broker/Engineer/Admin have a Manual ID set. Does NOT save the role change until the first property is assigned (for owner promotions).
- **`PropertyAssignCatalog.tsx`** — A full-screen modal displaying available properties fetched from `/api/roles/catalog`. Shows:
  - Apartments grouped by Building (for Broker mode)
  - Villas in a separate section
  - Each card shows `Unit #OBJECTID` (same ID as the public Property Catalog)
  - Searches by OBJECTID
- **`EditUserModal.tsx`** — A two-pane modal for editing any user:
  - Left pane: Form fields (Name, Phone, Email, ManualID, Age, etc.)
  - Right pane (Owners/Brokers only): List of assigned properties showing `Unit #<objectId>` and type (🏢 Apartment / 🏡 Villa). Has "+ Add" and "Remove" buttons.

### `RolesWidget.tsx`
Tab-based container that renders all 5 tables and manages the active role tab in the Admin Dashboard.

---

## E. Property Catalog (User-Facing Map)

**Component:** `frontend/src/components/UnitCatalog.tsx`

- Fetches data from `/api/roles/catalog?mode=all` (Express backend) — **NOT** from the ArcGIS JS SDK local cache. This guarantees that MongoDB's `ownerId` truth always wins over stale ArcGIS data.
- Displays all properties as cards in a draggable, resizable overlay on top of the 3D map.
- Each card shows: `Unit #OBJECTID`, type (Apartment/Villa/TwinHouse), price, and status badge (Available/Reserved/Sold).
- Clicking a card flies the 3D camera to that property.
- Has a **🔃 Refresh** button to re-fetch live data on demand.
- Status normalization: handles both text (`'Available'`, `'Sold'`) and numeric (`'1'`, `'4'`) ArcGIS status codes.

---

## F. Booking Request Flow (Agile 1 — Legacy Path)

The original "Proceed to Buy" flow for a standard user:
1. User submits an interest/booking request from the Property Catalog → saved to `BookingRequest` collection.
2. Admin approves via the Admin Requests page → triggers `approveRequest` in `bookingController.js`.
3. On approval:
   - `Unit` document is updated: `status: '4'`, **`ownerId: request.userId`** (critical — must be set!), `ownerName`, `ownerEmail`, `ownerPhone`.
   - ArcGIS is updated to Status 4 (Sold) with owner info.
   - User's `role` is changed to `'owner'` and the unit is added to `user.ownedUnits`.
   - All other pending requests for the same unit are rejected.

---

## G. AI Property Advisor (Agentic Workflow)

- Integrates Google Gemini 2.5 Flash as a Smart Agent.
- Uses RAG: feeds the LLM only "Available" units from MongoDB.
- Implements Function Calling (`book_unit`) so the AI can autonomously initiate a booking when a user confirms intent.
- Calculates ROI and filters units by budget.

---

## H. 3D Web GIS Features

- Full 3D Web Scene rendered using ArcGIS Maps SDK for JavaScript.
- Network Analysis: Routing Widget (Multi-Stop Route) and Closest Facility using `esriConfig.apiKey` → `VITE_ARCGIS_API_KEY`.
- Real-time Weather: Fetches from OpenWeatherMap. If description contains `"sand"` or `"dust"`, dynamically maps to 3D Scene atmosphere/weather properties.

---

# 4. Critical Technical Constraints & Known Bugs Fixed

1. **`sourceLayer` is MANDATORY on every Unit write.** Without it, `removeProperty` defaults to `'Units'` and Villas will never have their ArcGIS status correctly reverted to Available.
2. **`objectId` (numeric OBJECTID) must be saved alongside `arcgisId`.** For Villas, `arcgisId` is a GUID — only `objectId` gives you the human-readable number matching the Property Catalog.
3. **`ownerId` must always be set on Unit when a property is owned** — setting only `ownerName`/`ownerPhone` is insufficient. The `mode=all` catalog and the Property Catalog both rely on `ownerId != null` to mark a unit as Sold.
4. **ArcGIS JS SDK Cache:** `layer.queryFeatures()` reads from a local in-memory cache. The User Property Catalog bypasses this entirely by fetching from the Express backend instead. Do NOT use `layer.queryFeatures()` directly in the public-facing catalog.
5. **ArcGIS layer routing:** Apartments use `updateFeatures` endpoint. Villas/TwinHouses use `applyEdits` with `useGlobalIds: true`. These are in different Feature Services and must never be mixed.
6. **Mongoose Strict Mode:** The `Unit` schema uses `strict: false` to allow any fields (like `sourceLayer`, `objectId`, `buildingFK`) without them being silently dropped.
7. **Type Casting:** When comparing `unitId` from a request with MongoDB, be consistent — `arcgisId` is always stored as a `String`.
8. **Role commit timing:** When promoting a user to `owner`, the `role` field in MongoDB is saved **only after** the first property is assigned. Never save the role change in isolation before a property is confirmed.
9. **Owner downgrade:** When the last property is removed from an owner, automatically set `user.role = 'user'`. This is handled in both `removeProperty` and `bookingController`.
10. **Environment Variables:**
    - Backend `.env`: `PORT=5000`, `MONGO_URI`, `GEMINI_API_KEY`, `JWT_SECRET`, `OPENWEATHER_API_KEY`
    - Frontend `.env`: `VITE_API_URL` (Express backend base URL), `VITE_ARCGIS_API_KEY`

---

# 5. Current Data State (As of Agile Sprint 1 Completion)

- **Active Owner:** Amgad Ashraf Hamed — owns Apartments #2, #3, #4, #5 (MongoDB `arcgisId` = `'2'`, `'3'`, `'4'`, `'5'`; `sourceLayer: 'Units'`).
- All other properties are reset to Available (Status 1) in both MongoDB and ArcGIS.
- The `Admin-Portal-Roles` Git branch on GitHub contains all Agile Sprint 1 changes.

---

# 6. Next Phase — Agile Sprint 2 (Broker Portal & Booking Workflow)

Per `Agile_2_Logic_Design.md`, Sprint 2 will implement:
- A dedicated Broker Portal showing assigned properties and client interest requests.
- The 4-step booking workflow: `Interest → Booked → Sold`.
- Real-time notifications (Socket.io or polling) for new interest requests.
- Full integration with the existing `InterestRequest` / `BookingRequest` models.