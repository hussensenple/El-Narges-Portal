# Agile 2: Broker Portal Logic & Architecture Design

This document outlines the technical design (Backend & Frontend) required to implement Agile 2 (Broker's Portal) so it integrates seamlessly with the existing MERN + ArcGIS architecture, particularly building upon the roles created in Agile 1.

---

## 1. Database Schema Updates (MongoDB)

### 1.1 `Unit` Model Updates
The `Unit` schema (which has `strict: false`) already supports `brokerId`. We will rely on this heavily.
* `brokerId`: ObjectId linking to the User (Role: broker) managing this unit.

### 1.2 Role Profiles (NEW)
Since the `User` model is the base, we will create separate profile schemas for specific roles. These profiles will contain the manually assigned IDs and role-specific data.

```javascript
const brokerProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  manualId: { type: String, required: true, unique: true }, // Assigned by Admin
}, { timestamps: true });

const engineerProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  manualId: { type: String, required: true, unique: true },
  age: { type: Number },
  speciality: { type: String },
  graduationYear: { type: Number }
}, { timestamps: true });

const adminProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  manualId: { type: String, required: true, unique: true },
  age: { type: Number }
}, { timestamps: true });
```

### 1.3 `InterestRequest` Model (NEW)
Instead of immediately booking a unit and locking it, users submit an "Interest".
```javascript
const interestRequestSchema = new mongoose.Schema({
  unitId: { type: String, required: true }, // ArcGIS GlobalID or OBJECTID
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  brokerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { 
    type: String, 
    enum: ['active', 'pended', 'rejected', 'won'], 
    default: 'active' 
  },
  // 'active': Broker can see and contact them.
  // 'pended': Unit is "Booked" by someone else; kept as backup.
  // 'rejected': Broker deemed them not serious.
  // 'won': The user who actually bought the unit.
}, { timestamps: true }); 
// Note: timestamps are critical for the FIFO (Oldest to Newest) sorting requirement.
```

### 1.4 `BookingRequest` Model (Modified)
The existing `BookingRequest` model will be repurposed to handle the Broker -> Admin approval flow (Scenario A).
* Instead of Users creating `BookingRequests`, **Brokers** will create `BookingRequests` when a client agrees to buy, sending it to the Admin for final "Sold" confirmation.

---

## 2. Backend Logic (Node.js/Express)

### 2.1 User/Client Routes
* `POST /api/interests`: User submits interest for an "Available" unit. Looks up the unit's `brokerId` and creates an `InterestRequest`.
  * *Side-effect:* Updates unit status in MongoDB to "Interested" and triggers `arcgisService` to update the spatial layer to **`2 (Interested)`**.

### 2.2 Broker Routes
* `GET /api/brokers/my-units`: Fetches all units where `brokerId === req.user.id`.
* `GET /api/brokers/requests`: Fetches all `InterestRequest`s for the broker's units. Sorted by `createdAt ASC` (Oldest first).
* `PUT /api/brokers/requests/:id/reject`: Broker marks interest as 'rejected' (Client not serious).
* `POST /api/brokers/units/:unitId/book`: Broker changes unit to "Booked" (Status `3: Reserved`).
  * *Side-effect:* Updates unit in MongoDB. Updates ArcGIS via `arcgisService`. Changes all other active interests for this unit to `pended`.
* `POST /api/brokers/units/:unitId/unbook`: (Scenario B) Broker reverts "Booked" to "Available" (Status `1: Available`).
  * *Side-effect:* Updates MongoDB/ArcGIS. Reverts `pended` interests back to `active`.
* `POST /api/brokers/units/:unitId/request-sold`: (Scenario A) Broker requests Admin to finalize sale. Creates a `BookingRequest` for the Admin.

### 2.3 Admin Routes (Integration with Agile 1)
* `PUT /api/admin/bookings/:id/approve`: Admin approves the Broker's sale request.
  * *Side-effect:* Unit status changes to "Sold" (Status `4: Sold`). 
  * Unit assigned to the User (`ownerId` added, role changes to `owner`).
  * All `pended` and `active` `InterestRequest`s for this unit are permanently deleted or marked 'archived'.
  * ArcGIS spatial layer updated to "Sold".

---

## 3. Frontend Logic (React)

### 3.1 Broker Portal Structure (`/broker-portal`)
* **Layout:** Similar to `MapViewer.tsx`, protected by a `<BrokerRoute>` wrapper.
* **Component: `BrokerUnitCatalog.tsx`**
  * Fetches data from `/api/brokers/my-units`.
  * Displays only units the broker is assigned to.
  * Action buttons on cards: "Mark as Booked", "Revert to Available", "Request Sale Approval".
* **Component: `InterestRequestsWidget.tsx`**
  * Polling or Socket.io listener for new interests.
  * Displays list of users interested in specific units, sorted oldest first.
  * Buttons: "Call Client" (UI display of phone), "Not Serious (Reject)", "Client Buying (Book Unit)".

### 3.2 Real-time Sync (Socket.io)
* When a user creates an interest, emit `newInterest` to the specific Broker's socket room.
* When a broker books a unit, emit `unitStatusChanged` to all clients to update the UI (turning the unit yellow/reserved).

---

## 4. ArcGIS Integration Sync & Status Mapping
The system will now actively utilize all 4 domain values in the GIS layer:

* **Available (Status `1`)**: Properties with zero active interest requests.
* **Interested (Status `2`)**: Properties that have at least one active interest request, but are not yet formally booked. (New status triggered when the first interest is submitted).
* **Reserved/Booked (Status `3`)**: Properties explicitly marked as "Booked" by the Broker. All other interests are frozen.
* **Sold (Status `4`)**: Admin has confirmed the sale. The buyer becomes an `owner`. The Broker loses all control over this property.
