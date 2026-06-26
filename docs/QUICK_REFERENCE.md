# 🚗 Manivtha AI Car Assistant — Quick Reference Card

> A cheat-sheet for developers working on this project.

---

## 🔑 Default Credentials

| Role | Login Field | Value |
|------|------------|-------|
| Admin | Username | `admin` |
| Admin | Password | `manivtha2026` |
| Passenger | Email | Any email used in a submitted enquiry |
| Passenger | Phone | Any phone used in a submitted enquiry |

---

## 🌐 Application URLs

```
Frontend:  http://localhost:5173
Backend:   http://localhost:5000
Health:    http://localhost:5000/api/health
```

| Route | Description |
|-------|-------------|
| `/` | AI Car Recommendation Form |
| `/results` | AI Results (3 car cards) |
| `/enquiry` | Booking Enquiry Form |
| `/login` | Login (Passenger + Admin tabs) |
| `/history` | Passenger Booking History |
| `/dashboard` | Admin KPI Dashboard |
| `/booking/:id` | Admin Booking Detail Page |
| `/fleet` | Admin Fleet + Driver Management |

---

## 🚀 Start Commands

```powershell
# Backend (Port 5000)
cd "ai car project/backend"
npm run dev

# Frontend (Port 5173)
cd "ai car project/frontend"
npm run dev
```

---

## 📡 Key API Endpoints

```
POST   /api/auth/login              → Admin JWT token
POST   /api/auth/passenger-login    → Passenger JWT token
POST   /api/recommend               → AI car recommendations
POST   /api/recommend/chat          → Chatbot (Mani)
POST   /api/enquiries               → Submit new enquiry (public)
GET    /api/enquiries/my-history    → Passenger's own history (passengerAuth)
GET    /api/enquiries               → All enquiries (adminAuth)
GET    /api/enquiries/:id           → Single enquiry + history (adminAuth)
PATCH  /api/enquiries/:id/status    → Update status (adminAuth)
DELETE /api/enquiries/:id           → Cancel + erase + notify (passengerAuth)
GET    /api/vehicles                → List vehicles (public)
POST   /api/vehicles                → Add vehicle (adminAuth)
DELETE /api/vehicles/:id            → Delete vehicle (adminAuth)
GET    /api/drivers                 → List drivers (adminAuth)
POST   /api/drivers                 → Register driver (adminAuth)
DELETE /api/drivers/:id             → Remove driver (adminAuth)
GET    /api/dashboard/stats         → KPI stats (adminAuth)
GET    /api/health                  → Server health check
```

---

## 🛡️ Auth Headers

```http
Authorization: Bearer <jwt_token>
```

| Token | Storage Key | Expiry |
|-------|------------|--------|
| Admin | `localStorage['adminToken']` | 8 hours |
| Passenger | `localStorage['passengerToken']` | 24 hours |

---

## 💾 Database Tables

| Table | Purpose |
|-------|---------|
| `vehicles` | Car fleet (7 seeded) |
| `enquiries` | Booking requests from customers |
| `drivers` | Driver roster (3 seeded) |
| `bookings` | Confirmed booking records |
| `action_history` | Audit trail for each enquiry |

**Enquiry Statuses:** `pending` → `confirmed` → `cancelled`

---

## ⚡ Environment Variables (backend/.env)

```env
PORT=5000
GEMINI_API_KEY=AIzaSy...          # Set for real AI, leave placeholder for fallback
JWT_SECRET=your_secret_here
ADMIN_USER=admin
ADMIN_PASS=manivtha2026
FRONTEND_URL=http://localhost:5173
```

---

## 🔧 Important Rules

### Backend
- Always place specific routes (`/my-history`) **before** wildcard routes (`/:id`) in Express
- Call `persist()` after every DB write to save data to disk
- Admin middleware: `authMiddleware` | Passenger+Admin: `authMiddleware.passengerAuth`
- Notifications are **simulated** (console.log + API response) — not real email/SMS

### Frontend
- Use `toast.success()` / `toast.error()` — NEVER `window.alert()`
- Use `window.__showConfirmModal()` — NEVER `window.confirm()`
- Multi-step form state: `sessionStorage['recommendForm']` and `sessionStorage['selectedCar']`
- Auth state: `localStorage['adminToken']` and `localStorage['passengerToken']`
- All API calls use `/api/...` prefix (Vite proxies to `localhost:5000`)

---

## 📁 Project Structure

```
ai car project/
├── backend/              ← Node.js + Express + SQLite API
│   ├── server.js
│   ├── db/database.js    ← sql.js wrapper
│   ├── middleware/auth.js
│   ├── routes/           ← 6 route modules
│   └── services/aiService.js  ← Gemini + fallback
├── frontend/             ← React 18 + Vite
│   └── src/
│       ├── App.jsx
│       ├── hooks/useRecommendation.js
│       └── components/   ← 12 components
├── saas-backend/         ← PostgreSQL version (cloud deployment)
└── docs/                 ← THIS DOCUMENTATION FOLDER
    ├── PROJECT_DOCUMENTATION.md  ← Full docs with diagrams
    └── QUICK_REFERENCE.md        ← This file
```

---

## 🐛 Bugs Fixed

1. **Passenger `/my-history` 403 error** → Moved route above `/:id` wildcard in `enquiries.js`
2. **Cross-tab logout wiping both sessions** → Made `NavBar.handleLogout()` path-aware

---

*Manivtha Tours & Travels · Internship June 2026*
