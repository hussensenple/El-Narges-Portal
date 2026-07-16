# El Narges Portal — Master System Prompt

Act as an Expert System Architect, Full-Stack MERN Developer, and Web GIS Engineer. This document describes the **complete, current state** of the "El Narges Portal" system — including all architecture decisions, data models, API contracts, and critical constraints.

---

# 1. Project Overview

**"El Narges Portal"** is an interactive 3D Web GIS real estate platform that integrates real-time transactional data (MongoDB) with 3D spatial data (ArcGIS Feature Servers). It serves multiple user roles — Users, Owners, Brokers, Engineers, and Admins — and features:

- **AI-powered Property Advisor** (Google Gemini 2.5 Flash)
- **Full Admin Role Management Portal** (assign/remove properties, change roles, view dashboards)
- **Broker Portal** (assigned property catalog + real-time booking request management)
- **Owner Portal** (view owned units, submit complaints, track booking requests)
- **User Portal** (submit interest/booking requests, track request status)
- **Complaint Management** (internal & external complaints with coordinates)
- **3D Map with GIS Tools** (Closest Facility routing, Multi-Stop routing, Layer control, Basemap gallery)
- **Real-time dual-database synchronization** (MongoDB ↔ ArcGIS Feature Servers via Socket.io + REST)
- **Live Weather Overlay** (OpenWeatherMap API mapped onto the 3D scene)
- **2D/3D Map Toggle** (switch between SceneView and MapView)
- **Account Settings** (users/owners can update personal info and secondary contact)
- **Email Notifications** (booking approved/rejected/declined emails sent automatically)

The complete 4-step booking workflow is fully implemented:
`User submits Interest (Pending) → Broker reviews → raises to Admin (Reserved) or Declines → Admin Approves (Sold/Owner promoted) or Rejects`

---

# 2. Tech Stack

- **Frontend:** React.js (Vite), TypeScript, ArcGIS Maps SDK for JavaScript, Axios, React Router, Socket.io-client
- **Backend:** Node.js, Express.js, Socket.io, Mongoose/MongoDB
- **AI & APIs:** Google Gemini API (`@google/generative-ai`) for Agentic workflows, OpenWeatherMap API for live scene weather mapping, ArcGIS REST APIs (Feature Services & Network Analysis)
- **Database:** MongoDB (transactional logic & role management) + ArcGIS Online Feature Servers (spatial/3D map data)
- **Authentication (App):** JWT tokens stored in `localStorage`. Protected routes use `authMiddleware.js`.
- **Authentication (ArcGIS):** Uses ArcGIS `IdentityManager` for secured services like Network Analysis/Closest Facility. No API Key is used for routing to force organizational credit consumption via user login.

---

# 3. System Architecture & Core Features

## A. Dual-Database Architecture (MongoDB + ArcGIS)

The system runs two databases in parallel:
- **MongoDB** holds all application logic: user accounts, roles, property ownership (`ownerId`, `brokerId`), booking requests, complaints, and role profiles.
- **ArcGIS Online Feature Servers** hold the 3D spatial data (geometry, visual status colors, owner name/phone fields on map).

### The MongoDB `Units` Collection
This is the **critical bridge** between the two systems. A `Unit` document is created/updated in MongoDB whenever a property is assigned by admin or a booking request is approved.

| Field | Purpose |
|---|---|
| `arcgisId` | The ArcGIS OBJECTID (apartments) or GlobalID (villas) — used as the lookup key for all ArcGIS API calls |
| `objectId` | The numeric ArcGIS OBJECTID — used as the **display ID** shown to users |
| `globalId` | ArcGIS GlobalID (GUID string) |
| `unitName` | Human-readable label (e.g. "فيلا", "Apartment") |
| `sourceLayer` | `'Units'` for Apartments \| `'Villas_Global'` for Villas & TwinHouses — **CRITICAL** for routing ArcGIS update calls to the correct Feature Layer |
| `status` | `'1'` = Available, `'2'` = Interested, `'3'` = Reserved, `'4'` = Sold |
| `ownerId` | MongoDB ObjectId ref to `User` — set when property is assigned/sold to an owner |
| `brokerId` | MongoDB ObjectId ref to `User` — set when property is assigned to a broker |
| `ownerName`, `ownerEmail`, `ownerPhone` | Denormalized owner contact info (used for ArcGIS map pop-ups) |
| `strict: false` | Schema allows extra fields without rejection |

### ArcGIS Feature Layers (Live URLs)

| Layer | URL Segment | Update Method |
|---|---|---|
| Apartments (Units table) | `Map_3D_Final_WFL1/FeatureServer/37` | `updateFeatures` (OBJECTID numeric key) |
| Buildings | `Map_3D_Final_WFL1/FeatureServer/1` | `applyEdits` (OBJECTID or GlobalID) |
| Villas & TwinHouses | `Map_3D_Final_WSL3/FeatureServer/8` | `applyEdits` with `useGlobalIds: true` (GlobalID GUID key) |
| Services (Points) | `Services_Global` | Read-only for routing |

- **Services Type field:** 1=School, 2=Hospital, 3=Gym, 4=Commercial

---

## B. User Roles & the `User` Model

The `User` model (MongoDB) has a `role` field. Valid roles: `'user'`, `'owner'`, `'broker'`, `'engineer'`, `'admin'`.

**Role Constraints:**
- A `user` is promoted to `owner` automatically when a booking request is **Approved** by admin, OR when admin directly assigns a property.
- A `user` is promoted to `broker`, `engineer`, or `admin` only by admin assigning a `manualId`.
- An `owner` auto-downgrades to `user` if their last owned property is removed.
- A `broker` who is demoted has all their assigned units (`brokerId`) unlinked.

**Core MongoDB Models:**
- `User`: `{ name, phone, email, password, role, ownedUnits: [ObjectId ref Unit] }`
- `Unit`: `{ globalId, arcgisId, unitName, status, ownerName, ownerEmail, ownerPhone, ownerId, brokerId }` + `strict: false`
- `BookingRequest`: `{ userId, unitId, objectId, sourceLayer, buildingFK, customerName, customerPhone, customerGmail, status }`
- `Complaint`: `{ title, arcgisId, type (internal/external), description, coordinates: {lat, lon}, status, ownerId }`
- `BrokerProfile`: `{ userId, manualId }`
- `EngineerProfile`: `{ userId, manualId, age, speciality, graduationYear }`
- `AdminProfile`: `{ userId, manualId, age }`
- `KnowledgeBase`: Used by the AI Advisor for property/compound knowledge

---

## C. Admin Role Management & Portal

**Route prefix:** `/api/roles/`

| Endpoint | Method | Description |
|---|---|---|
| `/catalog?mode=owner\|broker\|all` | GET | Fetches properties from ArcGIS. For `all`: overrides status to `'4'` if `ownerId` exists in MongoDB |
| `/assign-property` | POST | Assigns property to owner or broker and syncs ArcGIS |
| `/remove-property` | POST | Removes property ownership, reverts ArcGIS to Available, checks building completeness |
| `/change-role/:userId` | PUT | Changes user role, creates/deletes profile documents |
| `/edit/:userId` | PUT | Edits user + profile info |
| `/:role` | GET | Lists all users of a given role with profile data |
| `/user-units/:userId?role=owner\|broker` | GET | Gets units assigned to a specific user |
| `/broker/:userId/performance` | GET | Returns broker KPIs (pie chart, bar chart, revenue in M EGP) |
| `/:userId` | DELETE | Deletes user and cleans up all related data |

### Frontend Admin Portal
Located under `frontend/src/components/admin/` and `frontend/src/pages/AdminRequests.tsx`:
- `AdminRequests.tsx` (page) — Main admin portal page with tabbed navigation
- `AdminDashboardTab.tsx` — Statistics, KPI metrics, charts
- `AdminComplaintsTab.tsx` — View and manage all user complaints
- `PropertyManagementTab.tsx` — Manage property assignments
- `RolesWidget.tsx` — Quick role switcher widget
- **Tables:** `OwnersTable.tsx`, `BrokersTable.tsx`, `EngineersTable.tsx`, `AdminsTable.tsx`, `UsersTable.tsx`
- **Modals:** `PropertyAssignCatalog.tsx` (assign properties), `EditUserModal.tsx`, `RoleChangeModal.tsx`, `BrokerPerformanceModal.tsx`

---

## D. Booking Workflow (Fully Implemented — 4 Steps)

**Route prefix:** `/api/bookings/`

| Endpoint | Method | Description |
|---|---|---|
| `/request` | POST | User submits interest (creates `BookingRequest` with status `Pending`, emits Socket.io event) |
| `/broker-pending` | GET | Broker fetches pending+reserved requests for their assigned units |
| `/broker-review/:requestId` | POST | Broker raises to admin (`Reserved` + ArcGIS sync) or declines (email sent) |
| `/approve/:requestId` | PUT | Admin approves: sets status `Approved`, syncs ArcGIS to Sold, promotes user to Owner, deletes competing requests, sends email |
| `/my-requests` | GET | Authenticated user gets their submitted requests + incoming requests on owned units |
| `/all-broker-pending` | GET | Admin fetches all pending requests grouped by broker |

**Booking status flow:** `Pending → Reserved (broker raised) → Approved (admin) / Rejected (admin) / Declined (broker)`

**Unique constraint:** `BookingRequest` has a compound unique index on `{ userId, unitId }` — a user cannot submit two requests for the same unit.

---

## E. Broker Portal (Fully Implemented)

`BrokerCatalog.tsx` — Broker's main view:
- Fetches all units assigned to the logged-in broker from `/api/roles/user-units/:userId?role=broker`
- Fetches pending+reserved booking requests from `/api/bookings/broker-pending`
- Displays units grouped as **Apartments** and **Villas** with red badge showing request count
- Real-time updates via Socket.io (`newBookingRequest` event)
- Click a unit → opens `BrokerUnitRequestsModal.tsx` to raise or decline each request
- Zoom-to-unit button navigates the 3D map camera to the property

`BrokerMapPopup.tsx` — In-map popup shown when broker clicks a feature on the 3D map.

---

## F. Owner Portal (Fully Implemented)

`OwnerUnitsTab.tsx` — Owner's main view:
- Lists all owned units (apartments and villas)
- Allows submitting complaints per unit (`ComplaintForm.tsx`)
- Allows viewing/tracking booking requests on their units
- Price update feature (syncs to ArcGIS via `updateArcGISPrice`)
- Zoom-to-unit on 3D map

---

## G. User Portal (Fully Implemented)

`UserRequestsModal.tsx` — User's request tracking view:
- Shows all submitted booking requests with current status
- Status labels: Pending (yellow), Reserved (purple), Approved/green, Rejected/red, Declined/gray

---

## H. Property Catalog (User-Facing Map)

`UnitCatalog.tsx`:
- Fetches data from `/api/roles/catalog?mode=all` (Express backend) — **NOT** from the ArcGIS JS SDK local cache to ensure real-time synchronization.
- Status normalization: handles both text (`'Available'`, `'Sold'`) and numeric (`'1'`, `'4'`) ArcGIS status codes.
- Allows clicking a card to zoom to the property on the 3D map and open the building sidebar.

`BuildingSidebar.tsx` — Shown when a building is clicked on the map. Displays all units within that building with their availability status.

---

## I. 3D Web GIS & Map Tools

- **3D Map (`MapViewer.tsx`):** ArcGIS SceneView with all Feature Layers loaded. Hit-test on click to identify buildings/villas. Opens `BuildingSidebar` for apartment buildings.
- **2D Map (`MapViewer2D.tsx`):** ArcGIS MapView with layers and basemap gallery. Has a "Switch to 3D" button.
- **Closest Facility (`ClosestServices.tsx`):** User clicks a residential building, selects service type (School, Hospital, Gym, Commercial), and gets the nearest route. Relies on ArcGIS `IdentityManager` — no API key injected.
- **Multi-Stop Routing (`StopsRoutingWidget.tsx`):** User adds multiple stops on the map and calculates a full route.
- **Weather Widget (`WeatherWidget.tsx`):** Fetches live weather via OpenWeatherMap backend route and overlays conditions on the 3D scene.
- **Layer Control:** Toggle visibility of map layers.
- **Basemap Gallery:** Switch between different basemap styles.

---

## J. AI Advisor (Fully Implemented)

`AIAdvisor.tsx`:
- Uses Google Gemini 2.5 Flash via the backend (`/api/ai/`)
- Powered by a `KnowledgeBase` MongoDB collection seeded with compound/property information
- Answers questions about available units, prices, location, and compound amenities
- Visible only to authenticated non-broker users on the 3D map view

---

## K. Backend Routes Summary

| Route Prefix | File | Key Purpose |
|---|---|---|
| `/api/auth` | `authRoutes.js` | Login, register |
| `/api/users` | `userRoutes.js` | User CRUD, account settings |
| `/api/bookings` | `bookingRoutes.js` | Full booking workflow |
| `/api/roles` | `rolesRoutes.js` | Role management, property assignment, catalog |
| `/api/admin` | `adminRoutes.js` | Admin-specific actions |
| `/api/complaints` | `complaintRoutes.js` | Complaint CRUD |
| `/api/ai` | `aiRoutes.js` | AI Advisor (Gemini) |
| `/api/weather` | `weatherRoutes.js` | Weather proxy (OpenWeatherMap) |

---

# 4. Critical Technical Constraints & Known Bugs Fixed

1. **`sourceLayer` is MANDATORY on every Unit write.** Missing it causes `updateArcGISStatus` to fail silently (`featureLayerUrl` becomes `undefined`).
2. **`objectId` (numeric OBJECTID) must be saved alongside `arcgisId`.** Used for display and for apartment ArcGIS calls.
3. **`ownerId` must always be set on the Unit document when a property is owned.**
4. **ArcGIS JS SDK Cache:** Do NOT use `layer.queryFeatures()` directly in the public-facing catalog (`UnitCatalog.tsx`). Always fetch from the backend API.
5. **Mongoose Strict Mode:** The `Unit` schema uses `strict: false` — extra fields like `sourceLayer`, `objectId`, `buildingFK` are persisted automatically.
6. **Network Analysis Login:** Never inject an API Key in `ClosestServices.tsx`. Always allow `IdentityManager` to popup for organizational credit consumption.
7. **BookingRequest unique index:** `{ userId, unitId }` compound unique index prevents duplicate submissions. Handle `error.code === 11000` on the backend.
8. **Villas ArcGIS update:** Always use `applyEdits` with `useGlobalIds: true` when the `arcgisId` contains a `-` (GUID format). Use `updateFeatures` only for `Units` (apartments).
9. **Building Completeness Check:** After selling/reverting an apartment unit, call `checkAndUpdateBuildingCompleteness(buildingFK)` to update the parent `Buildings_Global` layer status.
10. **Socket.io event name:** `'newBookingRequest'` — emitted by backend on every booking state change. Frontend components subscribe to this event for real-time refresh.

---

# 5. Frontend Component Map (Key Files)

```
frontend/src/
├── App.tsx                          ← Main layout, routing (/ and /admin), toolbar buttons, role-based UI
├── context/AuthContext.tsx          ← JWT auth state (localStorage-persisted), login/logout/updateUser
├── services/api.ts                  ← Axios base API helper
├── pages/
│   └── AdminRequests.tsx            ← Admin portal page (/admin route)
└── components/
    ├── MapViewer.tsx                 ← 3D SceneView, hit-test, layer loading
    ├── MapViewer2D.tsx               ← 2D MapView with basemap & layers
    ├── BuildingSidebar.tsx           ← Apartment unit list shown on building click
    ├── UnitCatalog.tsx               ← User-facing property catalog (fetches from backend)
    ├── BrokerCatalog.tsx             ← Broker's assigned units catalog with request badges
    ├── BrokerUnitRequestsModal.tsx   ← Broker raise/decline actions per unit
    ├── BrokerMapPopup.tsx            ← In-map popup for broker when clicking a feature
    ├── OwnerUnitsTab.tsx             ← Owner's units view with complaints & price update
    ├── UserRequestsModal.tsx         ← User's booking request tracking
    ├── AccountSettingsModal.tsx      ← User/owner account info update
    ├── AIAdvisor.tsx                 ← Gemini AI chatbot panel
    ├── AuthModal.tsx                 ← Login/register modal
    ├── ComplaintForm.tsx             ← Complaint submission form
    ├── ClosestServices.tsx           ← ArcGIS closest facility routing (no API key)
    ├── StopsRoutingWidget.tsx        ← Multi-stop route planner
    ├── WeatherWidget.tsx             ← OpenWeatherMap live weather on 3D scene
    └── admin/
        ├── AdminDashboardTab.tsx
        ├── AdminComplaintsTab.tsx
        ├── PropertyManagementTab.tsx
        ├── RolesWidget.tsx
        ├── tables/
        │   ├── OwnersTable.tsx
        │   ├── BrokersTable.tsx
        │   ├── EngineersTable.tsx
        │   ├── AdminsTable.tsx
        │   └── UsersTable.tsx
        └── modals/
            ├── PropertyAssignCatalog.tsx
            ├── EditUserModal.tsx
            ├── RoleChangeModal.tsx
            └── BrokerPerformanceModal.tsx
```

---

# 6. Current Development Status

All core features from the original roadmap are **fully implemented and running**:

| Feature | Status |
|---|---|
| 3D ArcGIS Map (SceneView) | ✅ Done |
| 2D ArcGIS Map (MapView) | ✅ Done |
| User Auth (JWT) | ✅ Done |
| Admin Role Management Portal | ✅ Done |
| Property Assignment (Admin → Owner/Broker) | ✅ Done |
| ArcGIS Dual-DB Sync (MongoDB ↔ ArcGIS) | ✅ Done |
| Broker Portal (Catalog + Request Management) | ✅ Done |
| 4-Step Booking Workflow | ✅ Done |
| Owner Portal (Units + Complaints + Price) | ✅ Done |
| User Request Tracking Modal | ✅ Done |
| AI Advisor (Gemini) | ✅ Done |
| Closest Facility Routing | ✅ Done |
| Multi-Stop Routing | ✅ Done |
| Weather Widget | ✅ Done |
| Real-time Socket.io Notifications | ✅ Done |
| Email Notifications (Booking status) | ✅ Done |
| Account Settings Modal | ✅ Done |
| Broker Performance Dashboard | ✅ Done |
| Building Completeness Check (ArcGIS) | ✅ Done |

Both dev servers are currently running:
- **Backend:** `http://localhost:5000` (Express + Socket.io + MongoDB)
- **Frontend:** Vite dev server (React + ArcGIS SDK)