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
- **Onboarding Walkthrough Tour** (role-based interactive guided tour using a dark CSS spotlight mask backdrop for Visitors, Users, and Owners, trackable via `localStorage`, with a manual restart button `📖` in the top right)

The complete 4-step booking workflow is fully implemented:
`User submits Interest (Pending) → Broker reviews → raises to Admin (Reserved) or Declines → Admin Approves (Sold/Owner promoted) or Rejects`

**Recent Feature Updates (July 2026):**
- **Engineer Dashboard Button:** A dedicated "Open Dashboard" button floats beside the Utility Network button for Engineers.
- **AI Chatbot Spatial Filtering:** The AI now uses `definitionExpression` queries to completely hide non-matching units/buildings from the 3D map instead of just highlighting them.
- **AI Spatial Guardrails:** Gemini is strictly forbidden from hallucinating unit counts; the frontend handles accurate proximity math and count generation.
- **Top-Aligned AI Questions:** Bilingual suggested questions are moved to the top of the Chatbot widget.

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
- `User`: `{ name, phone, email, password, role, governorate, countryStatus, ownedUnits: [ObjectId ref Unit] }`
- `Unit`: `{ globalId, arcgisId, unitName, status, ownerName, ownerEmail, ownerPhone, ownerId, brokerId }` + `strict: false`
- `BookingRequest`: `{ userId, unitId, objectId, sourceLayer, buildingFK, customerName, customerPhone, customerGmail, status }`
- `Complaint`: `{ title, arcgisId, type (internal/external), images: [String], description, coordinates: {lat, lon}, status, ownerId }`
- `BrokerProfile`: `{ userId, manualId }`
- `EngineerProfile`: `{ userId, manualId, age, graduationYear }` (Only ONE engineer allowed in the system)
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
| `/regions-stats` | GET | Analyzes user governorates and returns regional market share data with populated ownedUnits |
| `/:userId` | DELETE | Deletes user and cleans up all related data |

### Frontend Admin Portal
Located under `frontend/src/components/admin/` and `frontend/src/pages/AdminRequests.tsx`:
- `AdminRequests.tsx` (page) — Main admin portal page with tabbed navigation
- `AdminDashboardTab.tsx` — Analytics dashboard with redesigned layout:
  - **Center Column (Indicators & 3D Map):** Moves the 4 main indicators (Revenue, Sold, Reserved, Available) inside the center column to align directly with the width of the 3D Map viewer.
  - **Right Column (Analytics & Leaderboards):** Stacks the Pie Chart (Sold Units Ratio), Bar Chart (Property Status), and Top Brokers widget vertically. The Top Brokers widget features a custom UI mimicking a leaderboard (gold/silver/bronze rank circles, with SOLD/RAISED/DECLINED counts).
  - **Left Column (Regions, Owners & Sales):** Stacks the scrollable Top Selling Regions list (at the top), Top Owners list (sorted descending by total money paid for their properties via ArcGIS query, with large gold text for the paid amount), and Recent Sales list (at the bottom).
- `RolesWidget.tsx` — Quick role switcher widget
- `RejectionAnalysisTab.tsx` — Two-panel view for analyzing rejection reasons (filterable list + live recharts bar chart)
- **Tables:** `OwnersTable.tsx`, `BrokersTable.tsx`, `EngineersTable.tsx`, `AdminsTable.tsx`, `UsersTable.tsx`
- **Modals:** `PropertyAssignCatalog.tsx`, `EditUserModal.tsx`, `RoleChangeModal.tsx`, `BrokerPerformanceModal.tsx`, `OwnerPropertiesModal.tsx` (displays properties owned by selected user in top owners list, with map location sync matching owner dashboard design), `TopOwnersChartModal.tsx` (displays recharts bar chart of top 25 owners by paid amount)
- **Map Tools:** `AdminUnitSidebar.tsx` — Allows Admins and Engineers to click any building/unit on the 3D map to open a right-side panel containing unit ID, occupancy status, owner details, unit plan exploration, and internal/external complaints management for that specific unit.

---

## D. Booking Workflow (Fully Implemented — 4 Steps)

**Route prefix:** `/api/bookings/`

| Endpoint | Method | Description |
|---|---|---|
| `/request` | POST | User submits interest (creates `BookingRequest` with status `Pending`, emits Socket.io event) |
| `/broker-pending` | GET | Broker fetches pending+reserved requests for their assigned units |
| `/broker-review/:requestId` | POST | Broker raises to admin (`Reserved` + ArcGIS sync) or declines (email sent) |
| `/approve/:requestId` | PUT | Admin approves: sets status `Approved`, syncs ArcGIS to Sold, promotes user to Owner. Competing requests are auto-rejected with reason `Served By Another Client` instead of being deleted, and those users are emailed. |
| `/my-requests` | GET | Authenticated user gets their submitted requests + incoming requests on owned units |
| `/all-broker-pending` | GET | Admin fetches all pending requests grouped by broker |
| `/reject/:requestId` | POST | Admin rejects a request, captures `rejectionReason` (e.g. `Management Decision`) and `rejectionNotes`. Updates ArcGIS to Available, sends email. |

**Booking status flow:** `Pending → Reserved (broker raised) → Approved (admin) / Rejected (admin) / Declined (broker)`

**Rejection Tracking:** The `BookingRequest` model captures `rejectionReason` (dropdown domain) and `rejectionNotes` (textbox) when a Broker declines or an Admin rejects a request. This data is used for future analytics.

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

### Broker Self-Service Performance Dashboard
- **Dashboard Access:** Brokers have a dedicated Performance widget (bar chart icon) in the top-right toolbar of the 3D map view to view their performance metrics directly.
- **Unified Indicators Row:** Displays 5 statistics frames aligned horizontally side-by-side in a single line:
  1. **Available Units** (Green)
  2. **Reserved Units** (Yellow)
  3. **Sold Units** (Red)
  4. **Total Revenue** (Amber, in Millions EGP)
  5. **Commission** (Teal/Green gradient background frame)
- **Commission Formula:** Calculated as **1.5%** of the Total Revenue generated by sold properties (`revenueMEGP * 15`). Displays in Thousand EGP.
- **Enhanced Visual Charts:** Features enlarged Requests Conversion (Pie Chart) and Requests by Property Type (Bar Chart) set to an increased height of **420px** for high-resolution readability.

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

## J. AI Advisor & Engineer Chatbot (Fully Implemented)

`AIAdvisor.tsx` (Customer Facing):
- Uses Google Gemini Flash Latest via the backend (`/api/ai/ask`)
- Powered by a `KnowledgeBase` MongoDB collection seeded with compound/property information (filters out Engineering category) and supplemented by live units, prices, and occupancy statuses mapped directly from the ArcGIS layers in the prompt context.
- Answers questions about available/sold units, owner contact details, and compound amenities with real-time price awareness.
- Supports bilingual interaction (Arabic or English), replying in the same language as the user query.
- **Salary Affordability Evaluation (40% Rule):** When a user states their salary, the agent calculates their max monthly installment (40% of salary), matches it against the compound's 4 interest-free payment plans, recommends the best matching units and payment plans, and highlights these units on the 3D map.
- **Dynamic Investment & ROI Planner:** If the user asks for investment advice, the AI calculates a 5-Year ROI (20% annualized for Apartments, 15% for Villas) based on the user's budget/salary, and generates a structured investment plan outlining expected profits.
- **Family Size & Area Logic:** If the user mentions their family size (e.g., family of 4), the AI determines the recommended area (e.g. 150-220 sqm) and unit type (Apartment, TwinHouse, or Villa) according to Compound guidelines, sets `aiData.type`, and finds suitable units.
- Visible only to authenticated non-broker/non-engineer users on the 3D map view
- **Integrated Proximity Analysis:** Supports queries like *"apartments near gym within 5 mins"*. Calculates Haversine distance from services centroids (School, Hospital, Gym, Commercial) to filter map units.
- **Integrated Closest Facility Road Routing:** Supports queries like *"closest services to unit 99"*. Triggers actual ArcGIS Network Analysis road routing (`closestFacility.solve`) to solve routes, draws colored 3D path lines on the map (School is Green, Hospital is Yellow, Gym is Red, Commercial is Blue), and prints exact routing distances and walking times in the chat.

`ChatbotWidget.tsx` (Engineer Facing):
- Uses Google Gemini 2.5 Flash via the backend (`/api/ai/engineer-ask`)
- Powered exclusively by the `Engineering` category chunks in the `KnowledgeBase`
- Answers deep technical queries based strictly on the Master Engineering Manual (e.g. pressure parameters, testing intervals, electrical configs)
- Visible only to the Engineer role
- Includes quick-access "Suggested Questions" chips for instant querying without typing

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
| `/api/technicians` | `technicianRoutes.js` | Technician CRUD for Engineers |
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