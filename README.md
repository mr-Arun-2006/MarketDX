# 🩺 Market Diagnosis Platform
### *Diagnosis, Not Prediction.*

> Daily Structural Intelligence for NSE & BSE using EOD Data with Explainable AI

---

## 🚀 Quick Start (3 commands)

```bash
# 1. Clone & enter
cd market-diagnosis-platform

# 2. Setup environment
cp .env.example .env
# → Edit .env: set GEMINI_API_KEY, change passwords

# 3. Deploy
./scripts/deploy.sh prod
```

**Done!** Open → http://localhost

---

## 🔐 Login System (Completely Separate)

| Portal | URL | Credentials |
|--------|-----|-------------|
| **User Login** | http://localhost/login/user | Register via /signup |
| **User Signup** | http://localhost/signup | Open registration |
| **Admin Login** | http://localhost/login/admin | admin@mdp.com / Admin@123 |

> ⚠️ **Admin and User are 100% separate** — different login pages, different dashboards, different JWT flows. Admins cannot register publicly.

---

## 🤖 AI Integration (Google Gemini)

1. Get free API key → https://aistudio.google.com/app/apikey
2. Add to `.env`: `GEMINI_API_KEY=your_key_here`
3. Restart: `./scripts/deploy.sh restart backend`

**What AI does:**
- Generates daily diagnostic narrative (Module 9)
- Powers user AI chat assistant (market Q&A)
- Risk flag generation
- Fallback mode works without key (basic text report)

---

## 📦 Architecture

```
http://localhost (port 80)
        │
    ┌───┴────┐
    │ Nginx  │  ← single entry point
    └───┬────┘
        ├── /          → React Frontend (port 3000→80)
        ├── /api/*     → FastAPI Backend (port 8000)
        └── /health    → Health check

Backend Services:
  ├── FastAPI (API server, 2 workers)
  ├── Celery Worker (background jobs)
  ├── Celery Beat (IST 4PM scheduler)
  ├── PostgreSQL (persistent storage)
  └── Redis (cache + job queue)
```

---

## 📁 Project Structure

```
mdp/
├── docker-compose.yml          # All 6 services
├── .env.example                # Config template
├── .github/workflows/
│   └── pipeline.yml            # CI/CD: test → build → deploy
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py             # FastAPI app + admin seed
│       ├── core/
│       │   ├── config.py       # Pydantic settings
│       │   ├── database.py     # Async SQLAlchemy
│       │   ├── security.py     # JWT + bcrypt
│       │   ├── deps.py         # Auth guards
│       │   └── celery_app.py   # Scheduler (IST 4PM)
│       ├── models/models.py    # DB models (User, Score, Report, Chat)
│       ├── services/
│       │   ├── health_engine.py  # ⭐ All 10 modules
│       │   ├── ai_service.py     # Gemini integration
│       │   └── tasks.py          # Celery jobs
│       └── api/v1/
│           ├── auth.py     # /user/signup /user/login /admin/login
│           ├── market.py   # EOD data + AI report
│           ├── ai_chat.py  # AI Q&A
│           └── admin.py    # User management
├── frontend/
│   ├── Dockerfile              # Multi-stage: Vite → Nginx
│   └── src/
│       ├── pages/
│       │   ├── auth/           # UserLoginPage, UserSignupPage, AdminLoginPage
│       │   ├── user/           # UserDashboard, UserReport, UserAIChat
│       │   └── admin/          # AdminDashboard, AdminUsers, AdminMarket
│       ├── components/layout/  # UserLayout, AdminLayout (violet sidebars)
│       ├── store/authStore.js  # Zustand (persisted JWT)
│       └── utils/api.js        # Axios with auth interceptor
├── nginx/nginx.conf            # Reverse proxy
├── postgres/init.sql           # DB init
└── scripts/deploy.sh           # One-command deploy
```

---

## 🔬 10-Module Pipeline

| # | Module | What it does |
|---|--------|-------------|
| 1 | **Login** | User + Admin auth (JWT, bcrypt, separate flows) |
| 2 | **Data Collection** | yfinance → NSE (Nifty) + BSE (Sensex) + VIX |
| 3 | **Cleaning & Validation** | Null removal, format standardisation |
| 4 | **Feature Engineering** | RSI, SMA, A/D ratio, range%, exchange divergence |
| 5 | **Health Score** | Weighted 0–100 composite score |
| 6 | **Exchange Comparison** | NSE vs BSE return, breadth, divergence |
| 7 | **Regime Classification** | Bull / Bear / Sideways / Stable / Cautious / Stressed |
| 8 | **Regime Analysis** | Stress level, risk flags, pattern depth |
| 9 | **Explainable Analysis** | Gemini AI narrative + SHAP-style factor attribution |
| 10 | **Reporting** | Dashboard + AI report cards + Admin module view |

---

## 🎨 Design

- **Colors:** Violet (#7c3aed primary) + White — consistent across all pages
- **Font:** Abadi MT / Nunito (closest web alternative)
- **Theme:** Professional fintech — not dark, not plain white. Violet gradient sidebars, white content cards, violet accent throughout

---

## 🛠 Deploy Commands

```bash
./scripts/deploy.sh prod          # Build + start all
./scripts/deploy.sh dev           # Hot reload dev mode
./scripts/deploy.sh down          # Stop everything
./scripts/deploy.sh logs backend  # Follow backend logs
./scripts/deploy.sh status        # Container health
./scripts/deploy.sh migrate       # Run DB migrations
./scripts/deploy.sh shell         # Backend shell
./scripts/deploy.sh restart       # Restart all
```

---

## ⚙️ CI/CD Pipeline (.github/workflows/pipeline.yml)

```
Push to main
    ↓
① Backend tests (pytest)
② Frontend build check (vite build)
    ↓
③ Docker build + push to GHCR
    ↓
④ SSH deploy to production server
   (docker compose pull && up -d)
```

**GitHub Secrets needed for deploy:**
- `DEPLOY_HOST` — your server IP
- `DEPLOY_USER` — SSH user
- `DEPLOY_SSH_KEY` — private SSH key
- `VITE_API_URL` — your production API URL

---

## ⚠️ Compliance

This platform:
- ❌ Does NOT give buy/sell recommendations
- ❌ Does NOT predict prices
- ❌ Does NOT replace financial advisors
- ✅ Structural diagnosis only
- ✅ Transparent & explainable
- ✅ Academically defensible

---

*Department of Computer Science & Engineering — Project Phase I*
*Aakash R · Arun K · Arun R · Naveenkumar S*
*Guided by Dr. B. Sujatha M.E., PhD (Dean-Academics)*
