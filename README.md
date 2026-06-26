# Manivtha Tours & Travels — AI Car Recommendation Assistant

> **Internship Project** · June 2026 · 3-Student Team

An AI-powered car recommendation and booking management system for Manivtha Tours & Travels.

## 🚗 Features

- **AI Recommendations** — Answer 5 questions, get instant car matches (powered by Google Gemini)
- **Booking Enquiries** — Submit enquiries directly from recommendation results
- **Admin Dashboard** — Full booking management with KPIs, filters, and status tracking
- **AI Chatbot** — Floating "Mani" assistant helps customers find the right car conversationally
- **Fleet Management** — Add/remove vehicles and drivers
- **Passenger History** — Customers can view and cancel their own bookings
- **Booking Detail** — Full audit trail with AI reasoning stored per booking

## 🛠 Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | React 18 + Vite + CSS Variables     |
| Backend     | Node.js + Express                   |
| Database    | SQLite in-memory (sql.js + persist) |
| AI / LLM    | Google Gemini 1.5 Flash API         |
| Auth        | JWT (Admin + Passenger)             |
| Deployment  | Render.com (both services)          |

## ⚡ Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- A free Gemini API key from [aistudio.google.com](https://aistudio.google.com)

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env — paste your GEMINI_API_KEY
node server.js
```

Backend runs on `http://localhost:5000`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

### 3. Admin Login

Default credentials (change in `.env`):
- **Username**: `admin`
- **Password**: `manivtha2026`

---

## 🚀 Deployment Guide (Render.com — Free Tier)

### Step 1 — Push to GitHub

```bash
git init           # if not already a repo
git add .
git commit -m "Initial deployment-ready commit"
git remote add origin https://github.com/YOUR_USERNAME/manivtha-ai-car.git
git push -u origin main
```

### Step 2 — Deploy Backend on Render

1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your GitHub repo
3. Set **Root Directory** to `backend`
4. **Build Command**: `npm install`
5. **Start Command**: `npm start`
6. Add these **Environment Variables** in the Render dashboard:

```
PORT=5000
NODE_ENV=production
GEMINI_API_KEY=AIzaSy...
JWT_SECRET=some_long_random_secret
ADMIN_USER=admin
ADMIN_PASS=your_admin_password
FRONTEND_URL=https://your-frontend.onrender.com
```

7. Click **Deploy** — note the backend URL (e.g. `https://manivtha-backend.onrender.com`)

### Step 3 — Deploy Frontend on Render

1. **New** → **Static Site**
2. Connect the same GitHub repo
3. Set **Root Directory** to `frontend`
4. **Build Command**: `npm install && npm run build`
5. **Publish Directory**: `dist`
6. Add this **Environment Variable**:

```
VITE_API_URL=https://manivtha-backend.onrender.com
```

7. Add a **Redirect/Rewrite Rule**:
   - Source: `/*` → Destination: `/index.html` → Action: **Rewrite**
   - This is required for React Router to work on page refresh

8. Click **Deploy**

### Step 4 — Update CORS (important!)

After the frontend deploys, go back to the **backend** service → Environment Variables → update `FRONTEND_URL` to the actual frontend URL, then redeploy the backend.

---

## 📁 Project Structure

```
manivtha-car-assistant/
├── .gitignore
├── README.md
├── render.yaml              ← Render.com deployment blueprint
├── frontend/
│   ├── src/
│   │   ├── api.js           ← Centralized API base URL helper
│   │   ├── components/      ← All UI screens
│   │   ├── hooks/
│   │   ├── App.jsx
│   │   └── index.css        ← Design tokens & global styles
│   ├── .env.example
│   └── package.json
├── backend/
│   ├── routes/
│   ├── services/
│   ├── db/
│   ├── middleware/
│   ├── server.js
│   ├── .env.example
│   └── package.json
└── docs/
```

## 🔑 Environment Variables

### Backend (`backend/.env`)

```env
GEMINI_API_KEY=AIzaSy...        # From aistudio.google.com (FREE)
JWT_SECRET=change_this_secret
ADMIN_USER=admin
ADMIN_PASS=manivtha2026
PORT=5000
FRONTEND_URL=http://localhost:5173
```

### Frontend — only needed in production

```env
VITE_API_URL=https://your-backend.onrender.com
```

## 📋 API Endpoints

| Method | Route                        | Auth     | Description                       |
|--------|------------------------------|----------|-----------------------------------|
| POST   | /api/recommend               | No       | AI car recommendations            |
| POST   | /api/recommend/chat          | No       | AI chatbot reply (Mani)           |
| POST   | /api/enquiries               | No       | Submit booking enquiry            |
| GET    | /api/enquiries               | Admin    | List all enquiries                |
| GET    | /api/enquiries/my-history    | Passenger| View own booking history          |
| GET    | /api/enquiries/:id           | Admin    | Get single enquiry + audit trail  |
| PATCH  | /api/enquiries/:id/status    | Admin    | Update enquiry status             |
| DELETE | /api/enquiries/:id           | Pass/Admin| Cancel & permanently erase       |
| GET    | /api/vehicles                | No       | List all vehicles                 |
| POST   | /api/vehicles                | Admin    | Add vehicle to fleet              |
| DELETE | /api/vehicles/:id            | Admin    | Delete vehicle                    |
| GET    | /api/drivers                 | Admin    | List drivers                      |
| POST   | /api/drivers                 | Admin    | Register driver                   |
| DELETE | /api/drivers/:id             | Admin    | Delete driver                     |
| GET    | /api/dashboard/stats         | Admin    | KPI statistics                    |
| POST   | /api/auth/login              | No       | Admin login → JWT token           |
| POST   | /api/auth/passenger-login    | No       | Passenger login → JWT token       |
| GET    | /api/health                  | No       | Health check                      |
