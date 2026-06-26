# 🚗 Manivtha AI Car Assistant — Complete Project Documentation

> **Internship June 2026 · Manivtha Tours & Travels**  
> Full-stack AI-powered car rental recommendation system with an operational admin dashboard.

---

## 📑 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Full System Architecture Diagram](#3-full-system-architecture-diagram)
4. [Complete Workflow Diagram](#4-complete-workflow-diagram)
5. [Backend Architecture & Important Points](#5-backend-architecture--important-points)
6. [Frontend Architecture & Important Points](#6-frontend-architecture--important-points)
7. [Database Schema](#7-database-schema)
8. [API Reference](#8-api-reference)
9. [Authentication System](#9-authentication-system)
10. [Notification Flow](#10-notification-flow)
11. [Bugs Fixed & Known Limitations](#11-bugs-fixed--known-limitations)
12. [Running the Project Locally](#12-running-the-project-locally)

---

## 1. Project Overview

Manivtha AI Car Assistant is a **smart car rental recommendation web application** that helps customers find the best car for their trip using AI (Google Gemini 1.5 Flash) or a rule-based fallback system. It has two distinct user portals:

| Role | Portal URL | Access |
|------|-----------|--------|
| **Customer / Passenger** | `/` → `/results` → `/enquiry` → `/history` | Email or Phone login |
| **Admin / Operator** | `/login` → `/dashboard` → `/booking/:id` → `/fleet` | Username + Password (JWT) |

---

## 2. Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend Framework** | React 18 + Vite 5 |
| **Frontend Routing** | React Router DOM v6 |
| **Frontend Styling** | Vanilla CSS (custom design system) |
| **Toast Notifications** | react-hot-toast |
| **Backend Framework** | Node.js + Express.js |
| **Database (Primary)** | SQLite (via `sql.js` - in-memory + disk persistence) |
| **Database (SaaS/Cloud)** | PostgreSQL via `pg` (saas-backend) |
| **AI Engine** | Google Gemini 1.5 Flash (`@google/generative-ai`) |
| **Authentication** | JSON Web Tokens (JWT via `jsonwebtoken`) |
| **Password Hashing** | bcryptjs |
| **Environment Config** | dotenv |
| **Dev Proxy** | Vite proxy config (`/api` → `localhost:5000`) |

---

## 3. Full System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         BROWSER (CLIENT)                                │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    React SPA (Vite)                               │  │
│  │                    http://localhost:5173                          │  │
│  │                                                                   │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐   │  │
│  │  │  NavBar.jsx  │  │  ChatBot.jsx  │  │  ConfirmModal.jsx     │   │  │
│  │  │  (global)    │  │  (global FAB) │  │  (global dialog)     │   │  │
│  │  └─────────────┘  └──────────────┘  └───────────────────────┘   │  │
│  │                                                                   │  │
│  │  ┌─── Pages (Routes) ──────────────────────────────────────────┐ │  │
│  │  │  /              RecommendationForm.jsx (Step 1)             │ │  │
│  │  │  /results       ResultsPage.jsx + CarCard.jsx               │ │  │
│  │  │  /enquiry       EnquiryForm.jsx (Step 2 — Book)             │ │  │
│  │  │  /login         Login.jsx (Passenger + Admin tabs)          │ │  │
│  │  │  /history       PassengerHistory.jsx (Passenger portal)     │ │  │
│  │  │  /dashboard     Dashboard.jsx (Admin KPI + Enquiry Table)   │ │  │
│  │  │  /booking/:id   BookingDetail.jsx (Admin action panel)      │ │  │
│  │  │  /fleet         FleetManagement.jsx (Admin fleet + drivers) │ │  │
│  │  └─────────────────────────────────────────────────────────────┘ │  │
│  │                                                                   │  │
│  │  State: localStorage (adminToken, passengerToken)                 │  │
│  │         sessionStorage (recommendForm, selectedCar)               │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                         │  /api/* (Vite proxy)                         │
└─────────────────────────┼───────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────────────┐
│                       EXPRESS API SERVER                                 │
│                       http://localhost:5000                              │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  CORS Middleware  │  JSON Body Parser  │  JWT Auth Middleware    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──── Route Modules ──────────────────────────────────────────────┐   │
│  │  /api/auth       auth.js       (admin login, passenger login)   │   │
│  │  /api/recommend  recommend.js  (AI recommendation + chat)       │   │
│  │  /api/enquiries  enquiries.js  (CRUD for booking enquiries)     │   │
│  │  /api/vehicles   vehicles.js   (fleet management)               │   │
│  │  /api/drivers    drivers.js    (driver management)              │   │
│  │  /api/dashboard  dashboard.js  (KPI stats aggregation)          │   │
│  │  /api/health     server.js     (health check endpoint)          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  ┌──── Services ────────────────────────────────────────────────────┐  │
│  │  services/aiService.js                                           │  │
│  │  ├── getAIRecommendation() → calls Gemini 1.5 Flash             │  │
│  │  ├── getChatbotReply()     → Gemini chat with history            │  │
│  │  └── getRuleBasedRecommendation() → fallback logic              │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
│  ┌──── Database Layer ───────▼──────────────────────────────────────┐  │
│  │  db/database.js  (sql.js in-memory + disk persist to .db file)   │  │
│  │  ├── initDB()   → loads or creates manivtha.db                   │  │
│  │  ├── migrate()  → creates all tables (idempotent)               │  │
│  │  ├── seed()     → populates 7 vehicles + 3 drivers              │  │
│  │  ├── persist()  → writes in-memory DB to disk on every write     │  │
│  │  └── helpers: run(), get(), all(), insert()                      │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                              │                                           │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │
              ┌────────────────▼───────────────┐
              │     manivtha.db (SQLite file)   │
              │     (on disk — persisted)       │
              │                                 │
              │  Tables:                        │
              │  ├── vehicles                   │
              │  ├── enquiries                  │
              │  ├── drivers                    │
              │  ├── bookings                   │
              │  └── action_history             │
              └─────────────────────────────────┘
                               │
              ┌────────────────▼───────────────┐
              │   Google Gemini 1.5 Flash API  │
              │   (External — requires key)     │
              └─────────────────────────────────┘
```

---

## 4. Complete Workflow Diagram

### Customer Booking Workflow

```
Customer Opens App
       │
       ▼
┌─────────────────────────────────────┐
│   HOME PAGE  /                      │
│   RecommendationForm                │
│                                     │
│   User selects:                     │
│   • Trip Type                       │
│   • Passengers                      │
│   • Luggage                         │
│   • Comfort Level                   │
│   • Budget Min/Max                  │
│   • Pickup Date                     │
│                                     │
│   Stores form in sessionStorage     │
└──────────────────┬──────────────────┘
                   │ POST /api/recommend
                   ▼
         ┌─────────────────┐
         │  Gemini Key?    │
         └───┬─────────┬───┘
         YES │         │ NO
             ▼         ▼
    ┌────────────┐ ┌──────────────────────┐
    │ Gemini AI  │ │ Rule-Based Fallback  │
    │ 1.5 Flash  │ │ (aiService.js)       │
    └────────────┘ └──────────────────────┘
             │               │
             └───────┬───────┘
                     ▼
         Returns 3 recommendations
         + cross-referenced with DB
         (vehicle_id, image_url, qty)
                     │
                     ▼
┌─────────────────────────────────────┐
│   RESULTS PAGE  /results            │
│   ResultsPage + CarCard             │
│                                     │
│   Shows 3 car cards with:           │
│   • Image, Name, Category           │
│   • Seats, Luggage, Price/day       │
│   • AI Reason, Suitability Score    │
│   • [Book This Car] button          │
│                                     │
│   Stores selected car in            │
│   sessionStorage['selectedCar']     │
└──────────────────┬──────────────────┘
                   │ User clicks "Book This Car"
                   ▼
┌─────────────────────────────────────┐
│   ENQUIRY FORM  /enquiry            │
│   EnquiryForm                       │
│                                     │
│   Customer fills:                   │
│   • Full Name (required)            │
│   • Phone (required)                │
│   • Email                           │
│   • Pickup Location (required)      │
│   • Drop Location                   │
│   • Trip Date (required)            │
│   • Return Date                     │
│   • Special Requirements            │
└──────────────────┬──────────────────┘
                   │ POST /api/enquiries
                   ▼
         Record saved in DB
         action_history entry: "Enquiry Submitted"
                   │
                   ▼
        SUCCESS → Toast + redirect to /
```

### Admin Approval Workflow

```
Admin navigates to /login
       │
       ▼
┌─────────────────────────────────────┐
│   LOGIN PAGE  /login                │
│   Login.jsx (Admin tab)             │
│                                     │
│   Credentials: admin/manivtha2026   │
│   POST /api/auth/login              │
│   → JWT token (8h expiry)           │
│   Stored in localStorage['adminToken'] │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│   DASHBOARD  /dashboard             │
│   Dashboard.jsx                     │
│                                     │
│   KPI Cards:                        │
│   • Total Enquiries                 │
│   • Confirmed                       │
│   • Pending                         │
│   • Fleet Active/Total              │
│                                     │
│   Enquiry Table:                    │
│   • Filter by status                │
│   • Search by name/phone            │
│   • [View] button per row           │
└──────────────────┬──────────────────┘
                   │ Admin clicks [View]
                   ▼
┌─────────────────────────────────────┐
│   BOOKING DETAIL  /booking/:id      │
│   BookingDetail.jsx                 │
│                                     │
│   Shows: customer info, trip data,  │
│   assigned car, AI reasoning,       │
│   action_history timeline           │
│                                     │
│   Admin Actions:                    │
│   ┌─────────────────────────────┐   │
│   │ [Confirm Booking]           │   │
│   │  PATCH /api/enquiries/:id/  │   │
│   │  status { status: confirmed}│   │
│   │  → Updates DB status        │   │
│   │  → Adds to action_history   │   │
│   └─────────────────────────────┘   │
│   ┌─────────────────────────────┐   │
│   │ [Cancel & Erase Request]    │   │
│   │  → ConfirmModal dialog      │   │
│   │  DELETE /api/enquiries/:id  │   │
│   │  → Deletes enquiry          │   │
│   │  → Deletes action_history   │   │
│   │  → Deletes bookings         │   │
│   │  → Simulates notification   │   │
│   │  → Returns notification obj │   │
│   │  → Toast shows "Passenger   │   │
│   │    Notified!"               │   │
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Passenger History Workflow

```
Customer Opens /login
       │
       ▼
┌─────────────────────────────────────┐
│   LOGIN PAGE  /login                │
│   Login.jsx (Customer tab)          │
│                                     │
│   Enter Email or Phone              │
│   POST /api/auth/passenger-login    │
│   → Looks up enquiries table        │
│   → Returns JWT token (24h)         │
│   → Stored in localStorage          │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌─────────────────────────────────────┐
│   PASSENGER HISTORY  /history       │
│   PassengerHistory.jsx              │
│                                     │
│   GET /api/enquiries/my-history     │
│   (passengerAuth middleware)        │
│                                     │
│   Shows all enquiries by:           │
│   • email match OR phone match      │
│                                     │
│   Each card shows:                  │
│   • Enquiry ID + Date               │
│   • Status badge (PENDING /         │
│     CONFIRMED / CANCELLED)          │
│   • Trip details (type, pax, etc.)  │
│   • Assigned car + AI reason        │
│   • [Cancel Request & Erase] btn    │
└──────────────────┬──────────────────┘
                   │ Click Cancel
                   ▼
         ConfirmModal dialog
                   │ Confirm
                   ▼
         DELETE /api/enquiries/:id
         (ownership verified server-side)
                   │
                   ▼
         Notification Banner appears:
         "Passenger Notification Dispatch
          Successful — To: email@..."
```

---

## 5. Backend Architecture & Important Points

### Directory Structure

```
backend/
├── server.js              ← Entry point, boots DB then mounts routes
├── .env                   ← Environment variables (never commit!)
├── .env.example           ← Template for .env
├── package.json
├── db/
│   ├── database.js        ← sql.js wrapper + init + migrate + seed
│   └── manivtha.db        ← SQLite binary file (auto-created)
├── middleware/
│   └── auth.js            ← JWT auth: authMiddleware (admin) + passengerAuth
├── routes/
│   ├── auth.js            ← POST /login, POST /passenger-login
│   ├── recommend.js       ← POST /recommend, POST /recommend/chat
│   ├── enquiries.js       ← CRUD for enquiries + /my-history + DELETE
│   ├── vehicles.js        ← GET/POST/DELETE for fleet
│   ├── drivers.js         ← GET/POST/DELETE for drivers
│   └── dashboard.js       ← GET /stats (KPIs)
└── services/
    └── aiService.js       ← Gemini AI + fallback + chatbot
```

### ⚠️ Critical Backend Points

1. **Route Order Matters in Express**  
   Express resolves routes **sequentially**. Always define specific routes (like `/my-history`) **before** wildcard routes (like `/:id`) within the same router. Failing to do so causes the specific route to be swallowed by the wildcard.
   ```
   ✅ Correct order in enquiries.js:
      router.get('/my-history', ...)   ← specific
      router.get('/:id', ...)          ← wildcard
   ```

2. **Database Persistence Strategy**  
   `sql.js` runs the database entirely in memory. The `persist()` function is called after **every** write operation (`run()`, `insert()`) to serialize the in-memory database back to `manivtha.db` on disk. This means:
   - Fast reads (in-memory)
   - Writes are slightly slower (disk sync)
   - Data is NOT lost on server restart

3. **JWT Token Expiry**  
   - Admin tokens expire in **8 hours** — admins must re-login daily
   - Passenger tokens expire in **24 hours** — for overnight session support

4. **Authentication Middleware — Two Levels**  
   - `authMiddleware` → Only allows `role === 'admin'`. Used on all admin endpoints.
   - `authMiddleware.passengerAuth` → Allows both `passenger` AND `admin`. Used on passenger-facing endpoints and delete endpoint.

5. **AI Gemini Fallback**  
   If the `GEMINI_API_KEY` is not configured or starts with the placeholder `AIzaSyxxxxxxx`, the backend silently falls back to `getRuleBasedRecommendation()`. The frontend will never see an error — it always gets 3 car suggestions.

6. **Notification System (Simulated)**  
   Real email/SMS is **not integrated**. When a booking is deleted, the backend:
   - Logs a formatted message to the console (`console.log`)
   - Returns a `notification` object in the API response
   - The frontend renders this as a toast or banner UI element
   
   > To implement real notifications, integrate SendGrid (email) or Twilio (SMS) in the DELETE handler in `enquiries.js`.

7. **CORS Configuration**  
   The backend explicitly allows `http://localhost:5173` and `http://localhost:3000`. Update `FRONTEND_URL` in `.env` for production deployments.

8. **AI System Prompt (from Blueprint)**  
   The Gemini AI is instructed to respond in **strict JSON format** with exactly 3 recommendations. The backend strips any markdown code fences (` ```json `) before parsing. Never change the system prompt format without also updating the parsing logic.

9. **Booking Deletion Cascade**  
   The DELETE endpoint removes records from **three tables** atomically:
   ```js
   run('DELETE FROM enquiries WHERE enquiry_id = ?', [id]);
   run('DELETE FROM action_history WHERE enquiry_id = ?', [id]);
   run('DELETE FROM bookings WHERE enquiry_id = ?', [id]);
   ```
   There is no foreign key constraint enforcement in sql.js mode, so this manual cascade is critical.

10. **SaaS Backend (saas-backend/)**  
    A second backend directory exists with a **PostgreSQL** connection pool (`pg`) for cloud/production deployment. This version uses `pool.js` with `DATABASE_URL` or `PG*` env vars and is suitable for hosting on Railway, Supabase, Neon, or AWS RDS. It is NOT active in the local dev setup — the main `backend/` directory is used instead.

---

## 6. Frontend Architecture & Important Points

### Directory Structure

```
frontend/src/
├── App.jsx                    ← Router, Toaster provider, global layout
├── main.jsx                   ← React DOM render entry point
├── index.css                  ← Global CSS design system (variables, utilities)
├── hooks/
│   └── useRecommendation.js   ← Custom hook: POST /api/recommend + state
└── components/
    ├── NavBar.jsx / .css      ← Top navigation (role-aware)
    ├── RecommendationForm.jsx ← Home page — trip preference form (Step 1)
    ├── ResultsPage.jsx        ← Car recommendation results (Step 2)
    ├── CarCard.jsx            ← Individual car card with Book button
    ├── EnquiryForm.jsx        ← Booking form with customer details (Step 3)
    ├── Login.jsx              ← Dual-tab login (Customer + Admin)
    ├── PassengerHistory.jsx   ← Customer booking history + cancel flow
    ├── Dashboard.jsx          ← Admin KPI overview + enquiries table
    ├── BookingDetail.jsx      ← Admin individual booking view + actions
    ├── FleetManagement.jsx    ← Admin add/remove vehicles and drivers
    ├── ChatBot.jsx            ← Floating AI chatbot (Mani)
    └── ConfirmModal.jsx       ← Custom confirm dialog (replaces window.confirm)
```

### ⚠️ Critical Frontend Points

1. **Session Storage Strategy (Multi-Step Form)**  
   The recommendation flow relies on `sessionStorage` to pass data between pages:
   ```
   RecommendationForm → sessionStorage['recommendForm'] → ResultsPage
   CarCard (Book) → sessionStorage['selectedCar'] → EnquiryForm
   ```
   Both keys are cleaned up on successful enquiry submission. If a user navigates directly to `/results` without going through `/`, they are redirected to `/`.

2. **localStorage for Auth Tokens**  
   Two separate token keys are used:
   - `adminToken` + `adminUser` → admin sessions
   - `passengerToken` + `passengerUser` → customer sessions
   
   These tokens persist until manually cleared (logout) or browser storage is cleared.

3. **Context-Aware Logout (NavBar)**  
   The logout button only clears the token **matching the current route context**:
   - On `/dashboard`, `/booking/*`, `/fleet` → clears admin tokens only
   - On `/history` → clears passenger tokens only
   - Elsewhere → clears all tokens
   
   This prevents logging out another role's session when two tabs are open simultaneously.

4. **Custom Confirm Modal (window.__showConfirmModal)**  
   `ConfirmModal.jsx` registers itself globally as `window.__showConfirmModal(options)`. It returns a Promise that resolves to `true` (confirmed) or `false` (cancelled). This replaces the native `window.confirm()` browser dialog with a stylised modal that matches the app's dark theme.
   ```js
   const confirmed = await window.__showConfirmModal({
     title: 'Delete?',
     message: 'This cannot be undone.',
     danger: true,
     confirmLabel: '🗑️ Yes, Delete',
     cancelLabel: 'Keep It',
   });
   if (!confirmed) return;
   ```

5. **Vite Dev Proxy**  
   All API calls use the relative path `/api/...`. The Vite dev server proxies these to `http://localhost:5000`. This means:
   - No hardcoded backend URLs in the frontend code
   - CORS is not an issue in development
   - For production, configure your reverse proxy (Nginx/Caddy) to forward `/api` requests to the backend

6. **useRecommendation Hook**  
   A custom React hook wraps the AI recommendation API call, managing `loading`, `error`, and `results` state. It is used by both `RecommendationForm.jsx` (to fetch) and `ResultsPage.jsx` (to re-fetch and display). Shared state is preserved between routes via `sessionStorage`, not React state, so it survives page navigation.

7. **react-hot-toast Configuration**  
   All toast notifications are styled to match the dark theme (configured in `App.jsx` `<Toaster>` component). Do not use raw `alert()` or `window.alert()` anywhere in the code — always use `toast.success()`, `toast.error()`, or the base `toast()` function.

8. **Status Badge Color Mapping**  
   The status badge uses CSS classes that must be kept consistent across components:
   ```
   status === 'confirmed' → badge-success (green)
   status === 'pending'   → badge-warning (orange)
   status === 'cancelled' → badge-error (red)
   ```
   Applied in: `Dashboard.jsx`, `BookingDetail.jsx`, `PassengerHistory.jsx`.

9. **Passenger Notification Banner**  
   After a passenger cancels their own enquiry, the API returns `{ notification: { sent, to, phone, message } }`. This object is stored in React state (`setNotification`) and rendered as an inline banner at the top of the history page. The banner auto-includes a close (×) button to dismiss it.

10. **Fleet Management (Admin Only)**  
    `FleetManagement.jsx` requires an active admin token. It has two tabs: **Vehicles** and **Drivers**. The vehicle form posts to `POST /api/vehicles` with features as a comma-separated string (converted to a JSON array on submit). Images are referenced by URL (Unsplash or any CDN link).

---

## 7. Database Schema

```sql
-- Vehicle Fleet
CREATE TABLE IF NOT EXISTS vehicles (
  vehicle_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT NOT NULL,
  category          TEXT NOT NULL,        -- budget | standard | premium | luxury
  seats             INTEGER NOT NULL,
  luggage_capacity  TEXT NOT NULL,        -- small | medium | large
  price_per_day     REAL NOT NULL,
  quantity          INTEGER DEFAULT 1,
  is_available      INTEGER DEFAULT 1,    -- 0 = inactive
  features          TEXT,                 -- JSON array: ["AC","GPS","USB"]
  image_url         TEXT
);

-- Customer Booking Enquiries
CREATE TABLE IF NOT EXISTS enquiries (
  enquiry_id            INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name         TEXT NOT NULL,
  phone                 TEXT NOT NULL,
  email                 TEXT,
  trip_type             TEXT NOT NULL,
  passengers            INTEGER NOT NULL,
  luggage               TEXT NOT NULL,
  comfort_pref          TEXT NOT NULL,
  budget_min            REAL,
  budget_max            REAL,
  pickup_location       TEXT,
  drop_location         TEXT,
  trip_date             TEXT,
  return_date           TEXT,
  special_requirements  TEXT,
  status                TEXT DEFAULT 'pending',  -- pending | confirmed | cancelled
  ai_recommendation     TEXT,                    -- JSON blob from Gemini
  recommended_vehicle_id INTEGER,
  created_at            TEXT DEFAULT (datetime('now'))
);

-- Drivers
CREATE TABLE IF NOT EXISTS drivers (
  driver_id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name                  TEXT NOT NULL,
  phone                 TEXT NOT NULL,
  license_no            TEXT,
  is_available          INTEGER DEFAULT 1,
  assigned_booking_id   INTEGER,
  rating                REAL DEFAULT 5.0
);

-- Booking Records (linked to enquiries)
CREATE TABLE IF NOT EXISTS bookings (
  booking_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  enquiry_id    INTEGER,
  vehicle_id    INTEGER,
  driver_id     INTEGER,
  total_amount  REAL,
  advance_paid  REAL DEFAULT 0,
  status        TEXT DEFAULT 'pending',
  notes         TEXT,
  confirmed_at  TEXT
);

-- Audit Trail
CREATE TABLE IF NOT EXISTS action_history (
  history_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  enquiry_id   INTEGER,
  action       TEXT NOT NULL,
  performed_by TEXT DEFAULT 'system',
  timestamp    TEXT DEFAULT (datetime('now')),
  notes        TEXT
);
```

### Seeded Data

| Category | Vehicle | Price/Day |
|----------|---------|-----------|
| Budget | Alto K10 / WagonR | ₹900 |
| Standard | Swift Dzire | ₹1,400 |
| Standard+ | Honda City | ₹2,000 |
| Premium | Toyota Innova Crysta | ₹2,800 |
| Premium | Kia Carens | ₹2,500 |
| Luxury SUV | Toyota Fortuner | ₹4,500 |
| Luxury Sedan | Mercedes E-Class | ₹7,000 |

---

## 8. API Reference

### Authentication Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | None | Admin login → JWT |
| POST | `/api/auth/passenger-login` | None | Customer login by email/phone → JWT |

### Recommendation Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/recommend` | None | Get AI car recommendations |
| POST | `/api/recommend/chat` | None | Chat with AI assistant (Mani) |

### Enquiry Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/enquiries` | None | Submit a new booking enquiry |
| GET | `/api/enquiries/my-history` | Passenger JWT | Get all enquiries for logged-in passenger |
| GET | `/api/enquiries` | Admin JWT | List all enquiries (filter/search/paginate) |
| GET | `/api/enquiries/:id` | Admin JWT | Get single enquiry + action history |
| PATCH | `/api/enquiries/:id/status` | Admin JWT | Update enquiry status |
| DELETE | `/api/enquiries/:id` | Passenger/Admin JWT | Cancel + erase enquiry (with notification) |

### Vehicle & Driver Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/vehicles` | None | List all vehicles |
| POST | `/api/vehicles` | Admin JWT | Add vehicle to fleet |
| DELETE | `/api/vehicles/:id` | Admin JWT | Remove vehicle from fleet |
| GET | `/api/drivers` | Admin JWT | List all drivers |
| POST | `/api/drivers` | Admin JWT | Register new driver |
| DELETE | `/api/drivers/:id` | Admin JWT | Remove driver |

### Dashboard Endpoint

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/dashboard/stats` | Admin JWT | Get KPI counts + recent enquiries |

### Health Check

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | None | Server and Gemini config status |

---

## 9. Authentication System

```
                Admin Login Flow
                ─────────────────
  POST /api/auth/login
  Body: { username, password }
         │
         ├── Validates against ADMIN_USER and ADMIN_PASS env vars
         ├── Signs JWT with { username, role: 'admin' }
         │   Expiry: 8 hours
         └── Returns token + user object
                 │
                 ▼
         Frontend: localStorage['adminToken']
         All admin API calls include:
         Authorization: Bearer <token>

                Passenger Login Flow
                ─────────────────────
  POST /api/auth/passenger-login
  Body: { email } OR { phone }
         │
         ├── Queries enquiries table for a matching email OR phone
         ├── If found: signs JWT with { email, phone, customerName, role: 'passenger' }
         │   Expiry: 24 hours
         └── Returns token + user object
                 │
                 ▼
         Frontend: localStorage['passengerToken']
         All passenger API calls include:
         Authorization: Bearer <token>
```

### Middleware Chain

```
authMiddleware (admin-only routes):
  Check header → Verify JWT → Check role === 'admin' → next()

authMiddleware.passengerAuth (passenger + admin routes):
  Check header → Verify JWT → Check role === 'passenger' OR 'admin' → next()
  (Sets req.user = decoded JWT payload)
```

---

## 10. Notification Flow

```
When a booking is cancelled (by Admin OR Passenger):
         │
         ▼
DELETE /api/enquiries/:id
         │
         ├── Verify ownership (passenger: email/phone match)
         ├── DELETE from enquiries
         ├── DELETE from action_history
         ├── DELETE from bookings
         │
         └── Build notification object:
             {
               sent: true,
               to: enquiry.email || 'passenger@example.com',
               phone: enquiry.phone,
               message: '[NOTIFY] Dear {name}, your enquiry #{id} has been cancelled...'
             }
             │
             ├── console.log (simulated dispatch to server log)
             └── Return in API response as { notification: {...} }
                          │
                          ▼
               Frontend handles notification:

               ┌── Admin (BookingDetail.jsx)
               │   toast('🔔 Passenger Notified! To: ...', {icon: '📩'})
               │
               └── Passenger (PassengerHistory.jsx)
                   setNotification(data.notification)
                   → Renders inline notification banner
                   → Also fires secondary toast: '📩 Notification sent to ...'
```

---

## 11. Bugs Fixed & Known Limitations

### Bugs Fixed

| # | Bug | Root Cause | Fix Applied |
|---|-----|-----------|-------------|
| 1 | Passenger `/my-history` returned 403 | `/my-history` route was defined **after** the `/:id` wildcard in Express. Express matched `my-history` as an `id` param and ran the admin-only `authMiddleware`. | Moved `/my-history` route definition **above** the `/:id` route in `enquiries.js`. |
| 2 | Logging out in Admin tab also cleared Passenger session | `NavBar.handleLogout()` removed **all** localStorage keys regardless of which role was active. | Made logout **context-aware** based on the current URL path — only removes tokens for the active role. |

### Known Limitations

| Limitation | Notes |
|------------|-------|
| **No real notifications** | Email/SMS are simulated via `console.log` and UI banners. Integrate SendGrid/Twilio for production. |
| **Single-admin system** | Only one hardcoded admin user (`ADMIN_USER` env var). No multi-admin or role hierarchy. |
| **No real-time updates** | Dashboard and history require manual page refresh to see changes made by the other party. Add WebSockets or polling for live updates. |
| **No file uploads** | Vehicle images require external URLs (Unsplash CDN). No file upload system is integrated. |
| **Payments not integrated** | The `total_amount` and `advance_paid` fields exist in the `bookings` table but no payment gateway is connected. |
| **Session storage clears on tab close** | If a user closes the browser after Step 1 (RecommendationForm) but before Step 2, the form data is lost. |
| **No email verification** | Passenger login trusts any email/phone that matches an enquiry record — there is no OTP or password. |

---

## 12. Running the Project Locally

### Prerequisites

- **Node.js** v18+ (LTS recommended)
- **npm** v9+
- A **Gemini API Key** (optional — fallback works without it)

### Step 1: Start the Backend

```powershell
cd "ai car project/backend"
npm install            # First time only
npm run dev            # Starts on http://localhost:5000
```

### Step 2: Start the Frontend

```powershell
cd "ai car project/frontend"
npm install            # First time only
npm run dev            # Starts on http://localhost:5173
```

### Step 3: Configure Environment (Optional)

Edit `backend/.env`:
```env
PORT=5000
GEMINI_API_KEY=AIzaSy...your-real-key...   # Optional
JWT_SECRET=your_secret_key_here
ADMIN_USER=admin
ADMIN_PASS=manivtha2026
FRONTEND_URL=http://localhost:5173
```

### Default Credentials

| Role | Credential |
|------|-----------|
| **Admin** | Username: `admin` / Password: `manivtha2026` |
| **Passenger** | Email or phone used in any submitted enquiry |

### Application URLs

| Page | URL | Role |
|------|-----|------|
| Home / Recommendation Form | http://localhost:5173/ | Public |
| Car Results | http://localhost:5173/results | Public |
| Book a Car | http://localhost:5173/enquiry | Public |
| Login | http://localhost:5173/login | Both |
| My Booking History | http://localhost:5173/history | Passenger |
| Admin Dashboard | http://localhost:5173/dashboard | Admin |
| Admin Booking Detail | http://localhost:5173/booking/:id | Admin |
| Fleet Management | http://localhost:5173/fleet | Admin |
| API Health Check | http://localhost:5000/api/health | Public |

---

*Documentation last updated: June 2026*  
*Project: Manivtha AI Car Assistant — Internship Prototype*
