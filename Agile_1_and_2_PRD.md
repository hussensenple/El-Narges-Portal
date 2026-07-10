# El Narges Portal - Agile Development PRD

This document outlines the professional Product Requirements Document (PRD) for the upcoming two agiles: Agile 1 (Admin Portal - Roles & User Management) and Agile 2 (Broker's Portal & Booking Workflow).

---

## Agile 1: Admin Portal - Role & User Management

**Objective:** Enhance the Admin Dashboard by introducing a comprehensive "Roles" widget to view, manage, and assign properties/roles to all system users across 5 distinct categories.

### 1. The "Roles" Widget & Tables
A new widget titled **"Roles"** will be added to the Admin Portal. Upon opening, it presents 5 tabs/buttons corresponding to the system roles: **Users, Owners, Brokers, Engineers, Admins.**

#### 1.1 Users Table (Role: `user`)
* **Search:** Search bar to filter by **Phone Number**.
* **Columns:** Username | Phone Number | Email | Role | Edit
* **Actions:**
  * **Role Dropdown:** Change role to Owner, Broker, Engineer, or Admin. Upon changing the role, the user is immediately relocated to the respective table.
  * **Change to Owner:** Opens a "Property Catalog" window (showing only "Available" units/villas) with a search bar by Property ID. The admin assigns the purchased property to this new owner.
  * **Change to Broker:** Opens a form for the Admin to manually assign a **Broker ID**, then opens a modified "Property Catalog" showing "Available" or "Interested" units/villas that are **not currently assigned** to any broker. 
    * *Layout:* Grouped by Building ID (e.g., Header: Building X, followed by its unit cards). Assignment happens strictly on a **unit-by-unit** basis.
  * **Change to Engineer:** Opens a form for the Admin to manually assign an **Engineer ID**, Age, Speciality, and Graduation Year.
  * **Change to Admin:** Opens a form for the Admin to manually assign an **Admin ID** and Age, granting Admin Portal access.
  * **Edit:** Opens a form to modify Username, Phone Number, and Email.

#### 1.2 Owners Table (Role: `owner`)
* **Search:** Search bar to filter by **Phone Number**.
* **Columns:** Username | Phone Number | Email | Property Count | Role | Edit
* **Actions:**
  * **Role Dropdown:** Change to `user`. 
    * *Side-effect:* Automatically resets all properties owned by this user to "Available".
  * **Edit:** Modify user info. Below the form, display cards of owned properties.
    * Each card has a "Remove Property" button.
    * If the *last* property is removed, the owner automatically downgrades to role `user`.
    * Include an "Add Property" button opening the catalog (Available units only) to assign more properties.

#### 1.3 Brokers Table (Role: `broker`)
* **Search:** Search bar to filter by **Manual Broker ID**.
* **Columns:** Username | Phone Number | Email | Marketed Properties Count (Villas + Units) | Role | Performance | Edit
* **Actions:**
  * **Role Dropdown:** Change to `user`.
    * *Side-effect:* All properties assigned to this broker become unassigned (free for other brokers). The broker's profile and ID are removed.
  * **Edit:** Modify broker info (including Manual ID). Below the form, display cards of assigned properties (Interested or Available) with a "Remove" button.
    * Include an "Add Property" button opening the catalog to assign unassigned properties.
  * **Performance:** Opens a placeholder window for the "Broker's Dashboard" (to be designed later). Accessible by both Admin and the Broker.

#### 1.4 Engineers Table (Role: `engineer`)
* **Search:** Search bar to filter by **Manual Engineer ID**.
* **Columns:** Username | Phone Number | Email | Speciality | Graduation Year | Age | Role | Edit
* **Actions:**
  * **Role Dropdown:** Change to `user`. Removes them from this table and deletes their Engineer profile.
  * **Edit:** Modify engineer-specific info (Manual ID, Age, Speciality, Graduation Year) and contact details.

#### 1.5 Admins Table (Role: `admin`)
* **Search:** Search bar to filter by **Manual Admin ID**.
* **Columns:** Username | Phone Number | Email | Age | Role | Edit
* **Actions:**
  * **Role Dropdown:** Change to `user`. Removes them from this table and deletes their Admin profile.
  * **Edit:** Modify admin info (Manual ID, Age).

---

## Agile 2: Broker's Portal & Booking Workflow

**Objective:** Create a dedicated map-centric portal for Brokers to manage interest requests and finalize property sales through a newly defined Booking Scenario.

### 1. Broker Portal Interface
* **Map-Centric Design:** Built on the 3D MapViewer, tailored for broker workflows.
* **Redesigned Unit Catalog:** Modified to show only properties assigned to the logged-in broker.
* **New Widget - "Requests":** A panel to view and manage incoming client interest requests for their assigned properties.

### 2. The Booking Scenario
A strict, fair, and organized workflow for handling property sales:

1. **Client Interest:** A `user` logs in, views "Available" properties, and raises an interest request. 
   * *Status Change:* The property's status immediately changes from "Available" to **"Interested"** across the system (including the GIS map).
2. **Broker Handling (FIFO):** 
   * The assigned broker receives the interest request in their "Requests" widget.
   * Requests are sorted **Oldest to Newest** to prioritize early clients.
   * The broker calls the client.
3. **Filtering Interests:**
   * If the client is *not serious*: Broker terminates/deletes the request. (If it was the last request, property reverts to "Available").
   * If the client is *serious*: Broker updates the property status to **"Booked"** (Reserved).
4. **The "Booked" (Reserved) State:**
   * The property no longer accepts new interest requests.
   * All other existing pending requests for this property are frozen/pended as backups.
5. **Finalizing the Deal:**
   * **Scenario A (Success - Sold):** The client buys the property. The Broker submits a "Change to Sold" request to the Admin. Once the Admin confirms, the status becomes **"Sold"**. The client is promoted to an **Owner**, the Broker completely loses control over this property, and all pended backup requests are permanently deleted.
   * **Scenario B (Failure - Back to Interested/Available):** The client backs out. The Broker reverts the "Booked" status. The frozen backup requests are immediately released/reactivated so the Broker can contact the next person in line.
