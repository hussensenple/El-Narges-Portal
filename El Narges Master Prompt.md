# El Narges Portal — Master System Prompt

Act as an Expert System Architect, Full-Stack MERN Developer, and Web GIS Engineer. This document describes the **complete, current state** of the "El Narges Portal" system — including all architecture decisions, data models, API contracts, and critical constraints.

---

# 1. Project Overview

**"El Narges Portal"** is an interactive 3D Web GIS real estate platform that integrates real-time transactional data (MongoDB) with 3D spatial data (ArcGIS Feature Servers). It serves multiple user roles — Users, Owners, Brokers, Engineers, and Admins — and features an AI-powered Property Advisor, a full Admin Role Management Portal, Complaint Management, and real-time dual-database synchronization.

---

# 2. Tech Stack

- **Frontend:** React.js (Vite), TypeScript, ArcGIS Maps SDK for JavaScript, Axios, React Router
- **Backend:** Node.js, Express.js, Socket.io, Mongoose/MongoDB
- **AI & APIs:** Google Gemini API (`@google/generative-ai`) for Agentic workflows, OpenWeatherMap API for live scene weather mapping, ArcGIS REST APIs (Feature Services & Network Analysis)
- **Database:** MongoDB (transactional logic & role management) + ArcGIS Online Feature Servers (spatial/3D map data)
- **Authentication (ArcGIS):** Uses ArcGIS IdentityManager for secured services like Network Analysis/Closest Facility (No API Key used for routing to allow credit consumption via user login).

---

# 3. System Architecture & Core Features

## A. Dual-Database Architecture (MongoDB + ArcGIS)

The system runs two databases in parallel:
- **MongoDB** holds all application logic: user accounts, roles, property ownership (`ownerId`, `brokerId`), booking requests, complaints, and broker profiles.
- **ArcGIS Online Feature Servers** hold the 3D spatial data (geometry, visual status colors, owner name/phone fields on map).

### The MongoDB `Units` Collection
This is the **critical bridge** between the two systems. A `Unit` document is created/updated in MongoDB whenever a property is assigned or a booking is approved.

| Field | Purpose |
|---|---|
| `arcgisId` | The ArcGIS OBJECTID (apartments) or GlobalID (villas) — used as the lookup key for all ArcGIS API calls |
| `objectId` | The numeric ArcGIS OBJECTID — used as the **display ID** shown to users |
| `globalId` | ArcGIS GlobalID (GUID string) |
| `sourceLayer` | `'Units'` for Apartments \| `'Villas_Global'` for Villas & TwinHouses — **CRITICAL** for routing ArcGIS update calls to the correct Feature Layer |
| `status` | `'1'` = Available, `'2'` = Interested, `'3'` = Reserved, `'4'` = Sold |
| `ownerId` | MongoDB ObjectId ref to `User` — set when property is assigned/sold to an owner |
| `brokerId` | MongoDB ObjectId ref to `User` — set when property is assigned to a broker |
| `strict: false` | Schema allows extra fields without rejection |

### ArcGIS Feature Layers
- **Apartments (Units table):** Uses `OBJECTID` (numeric) as primary key. Updated via `updateFeatures`.
- **Villas & TwinHouses:** Uses `GlobalID` (GUID string) as primary key. Updated via `applyEdits` with `useGlobalIds: true`.
- **Buildings:** `Buildings_Global` layer for hit-tests and navigation.
- **Services:** `Services_Global` layer for routing & closest facility. Type field defines service type (1=School, 2=Hospital, 3=Gym, 4=Commercial).

---

## B. User Roles & the `User` Model

The `User` model (MongoDB) has a `role` field. Valid roles: `'user'`, `'owner'`, `'broker'`, `'engineer'`, `'admin'`.

**Role Constraints:**
- A `user` can only be promoted to `owner` if they are assigned at least 1 property.
- A `user` can only be promoted to other roles if assigned a manual ID.
- An `owner` downgrades to `user` if their last owned property is removed.

**Core Models:**
- `User`: `{ name, phone, email, password, role, ownedUnits: [ObjectId] }`
- `Complaint`: `{ title, arcgisId, type (internal/external), description, coordinates, status, ownerId: ObjectId }`
- `BookingRequest`: `{ userId, unitId, objectId, sourceLayer, status }`

---

## C. Admin Role Management & Portal

- `/api/roles/assign-property`: Assigns property and syncs ArcGIS.
- `/api/roles/remove-property`: Removes property based on MongoDB `sourceLayer`.
- `/api/roles/catalog?mode=all`: Fetches properties. Overrides ArcGIS status to '4' if `ownerId` exists in MongoDB.

### Frontend Admin Portal
Located under `frontend/src/components/admin/`:
- `AdminDashboardTab.tsx`: Shows statistics and metrics.
- `AdminComplaintsTab.tsx`: Manages user complaints.
- Tables (`OwnersTable`, `BrokersTable`, etc.) for user management.

---

## D. Property Catalog (User-Facing Map)

- Fetches data from `/api/roles/catalog?mode=all` (Express backend) — **NOT** from the ArcGIS JS SDK local cache to ensure synchronization.
- Status normalization: handles both text and numeric ArcGIS status codes.

---

## E. 3D Web GIS & Network Analysis

- **Closest Facility (Routing):** `ClosestServices.tsx` allows users to click on any residential building and find routes to the nearest services (School, Hospital, Gym, Commercial).
- **Authentication:** Relies on ArcGIS `IdentityManager`. No `esriConfig.apiKey` is passed to `closestFacility.solve`. This forces a login prompt to consume organizational credits.
- **Real-time Weather:** Integrated with OpenWeatherMap API.

---

# 4. Critical Technical Constraints & Known Bugs Fixed

1. **`sourceLayer` is MANDATORY on every Unit write.** 
2. **`objectId` (numeric OBJECTID) must be saved alongside `arcgisId`.** 
3. **`ownerId` must always be set on Unit when a property is owned**.
4. **ArcGIS JS SDK Cache:** Do NOT use `layer.queryFeatures()` directly in the public-facing catalog.
5. **Mongoose Strict Mode:** The `Unit` schema uses `strict: false`.
6. **Network Analysis Login:** Never inject an API Key in `ClosestServices.tsx`. Always allow IdentityManager to popup for credit consumption.

---

# 5. Next Phase — Agile Sprint 2

- Broker Portal showing assigned properties and client interest requests.
- 4-step booking workflow: `Interest → Booked → Sold`.
- Real-time notifications for requests and complaints.