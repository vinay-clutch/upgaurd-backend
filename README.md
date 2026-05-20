# UpGuard Backend — Real-Time Website Monitoring API

> 🚀 The backend engine powering UpGuard — featuring AI/ML anomaly detection, predictive capacity forecasting, real-time socket alerts, and intelligent root cause diagnosis.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express.js |
| Database | PostgreSQL (via Prisma ORM) |
| Real-time | Socket.IO |
| Queue/Cache | Upstash Redis (BullMQ) |
| Email Alerts | Resend API |
| Auth | JWT + Google OAuth 2.0 |
| AI/ML Engine | Custom (aimlService.ts) |

---

## 🤖 AI/ML Engines Included

1. **Decision Tree Root Cause Classifier** — Diagnoses why a website failed (DNS, TLS, Port Blocked, etc.)
2. **Dual Anomaly Detector** — Z-Score + IQR statistical filters to catch latency spikes
3. **Isolation Forest** — Multi-dimensional outlier detection (latency + body size + status)
4. **ARIMA Capacity Forecaster** — Predicts how many days until server saturation (>3000ms)
5. **K-Means Incident Clustering** — Groups related outages to suppress alert spam

---

## ⚡ Quick Start (After Cloning)

### 1. Prerequisites
Make sure you have these installed:
- [Node.js v18+](https://nodejs.org/)
- [PostgreSQL 14+](https://www.postgresql.org/download/) — running locally on port 5432

### 2. Clone the repo
```bash
git clone https://github.com/vinay-clutch/upgaurd-backend.git
cd upgaurd-backend
```

### 3. Install dependencies
```bash
npm install
```

### 4. Set up environment variables
```bash
# Copy the example file
copy .env.example .env
```
Then open `.env` and fill in your values:
```env
CLIENT_URL="http://localhost:5173"
DATABASE_URL="postgresql://postgres@localhost:5432/upguard?sslmode=disable"
JWT="any_long_random_secret"
Mail_API="re_your_resend_api_key"
NODE_ENV="development"
PORT="8080"
REDIS_URL="rediss://default:password@your-upstash-host:6379"
REGION_ID="us-east-1"
SESSION_SECRET="any_long_random_secret"
WORKER_ID="worker-1"
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_secret"
```

### 5. Set up the database
```bash
# Create the local PostgreSQL database
psql -U postgres -c "CREATE DATABASE upguard;"

# Push the Prisma schema to your database
npx prisma db push

# Seed initial monitoring regions
npm run seed
```

### 6. Run all services (3 separate terminals)

**Terminal 1 — Main API Server:**
```bash
npm run dev
```
> API running at http://localhost:8080

**Terminal 2 — Website Monitor Worker:**
```bash
npm run worker
```
> Checks all monitored websites every 30 seconds

**Terminal 3 — AI/ML Analytics Worker:**
```bash
npm run analytics
```
> Runs anomaly detection + capacity forecasting every 10 seconds

**Terminal 4 (optional) — Queue Pusher:**
```bash
npm run pusher
```
> Pushes websites into the Redis job queue

---

## 📁 Project Structure

```
src/
├── controllers/
│   ├── websiteController.ts   # Main REST API controllers
│   └── analyticsController.ts # RUM analytics API
├── services/
│   ├── aimlService.ts         # 🧠 All 5 AI/ML algorithms
│   ├── notificationService.ts # Email + Discord + Slack alerts
│   └── discordService.ts      # Discord webhook sender
├── worker/
│   ├── index.ts               # Website monitoring worker
│   └── analyticsWorker.ts     # AI/ML background processor
├── pusher/
│   └── index.ts               # Redis queue pusher
├── routes/
│   ├── websiteRouter.ts       # /websites/* API routes
│   └── analyticsRouter.ts     # /analytics/* API routes
├── lib/
│   └── db.ts                  # Prisma client singleton
└── index.ts                   # App entry point
prisma/
└── schema.prisma              # Full database schema
```

---

## 🔌 Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get JWT token |
| GET | `/websites` | List all monitored websites |
| POST | `/websites` | Add new website to monitor |
| GET | `/websites/:id/status` | Full website status + AI forecast |
| GET | `/websites/:id/ssl` | SSL certificate check |
| GET | `/websites/:id/security` | HTTP security headers scan |
| GET | `/websites/:id/incidents` | Incident history |
| GET | `/websites/aiml/stats` | AI/ML analytics dashboard data |
| GET | `/websites/remediation/suggest` | Smart fix suggestions |
| GET | `/analytics/:id/live-count` | Live visitor count (RUM) |

---

## 🧪 Verify AI/ML is Working

After running the analytics worker for a few minutes, check your database:

```sql
-- Check detected anomalies
SELECT * FROM "AnomalyEvent";

-- Check capacity forecasts
SELECT * FROM "CapacityForecast";

-- Check incident clusters
SELECT * FROM "IncidentCluster";
```

---

## 📜 Available npm Scripts

```bash
npm run dev        # Start development server with hot reload
npm run build      # Compile TypeScript to JavaScript
npm run worker     # Start website monitoring worker
npm run analytics  # Start AI/ML analytics worker
npm run pusher     # Start Redis queue pusher
npm run seed       # Seed monitoring regions to database
```
