# MarketDX — Market Diagnosis Explorer
### Diagnosis, Not Prediction.

MarketDX is a full-stack financial analysis platform that diagnoses end-of-day market structure for NSE/BSE data using a modular analytics pipeline and explainable AI.

## Engineering Highlights

- **Backend:** FastAPI, async SQLAlchemy, PostgreSQL, Redis, Celery
- **Frontend:** React/Vite
- **API:** Versioned REST endpoints, health checks, authentication, market data, AI chat and webhooks
- **Security:** JWT access/refresh tokens, bcrypt password hashing, environment-based secrets and restricted CORS configuration
- **Testing:** Pytest-based backend tests covering API health/root behavior and authentication primitives
- **CI/CD:** GitHub Actions runs blocking backend tests and frontend builds; main-branch Docker builds can publish to GHCR and deploy through the configured deployment workflow
- **Containers:** Docker Compose with PostgreSQL, Redis, FastAPI, React/Nginx, Celery worker and Celery Beat
- **Reliability:** Service health checks, background task processing, database transaction rollback handling and structured application logging
- **AI:** Gemini integration for explainable market narratives and conversational analysis

## System Architecture

```text
Browser
   |
   v
Nginx Reverse Proxy
   |
   +--> React/Vite Frontend
   |
   +--> FastAPI REST API
          |
          +--> PostgreSQL (persistent data)
          +--> Redis (cache / queue)
          +--> Celery Worker / Beat (background automation)
          +--> Market Data Services
          +--> Gemini AI Service
```

## End-of-Day Diagnosis Pipeline

```text
Market Data
    ↓
Cleaning & Validation
    ↓
Feature Engineering
    ↓
Health Score
    ↓
NSE/BSE Comparison
    ↓
Regime Classification
    ↓
Risk / Stress Analysis
    ↓
Explainable AI Narrative
    ↓
Dashboard + Reports
```

## Software Engineering Evidence

### API development

The FastAPI service exposes health, authentication, market, AI, admin, WebSocket and webhook routes. The application uses `/api/v1` versioning and a dedicated `/health` endpoint for service monitoring.

### Testing

Backend tests use FastAPI's `TestClient` and Pytest. The test suite covers API health/root responses and authentication behavior including password hashing, token round trips and invalid-token rejection.

Run locally:

```bash
cd backend
pip install -r requirements.txt
pip install pytest pytest-asyncio httpx
pytest tests/ -v
```

### CI/CD

GitHub Actions validates the backend test suite and frontend build on pull requests and pushes. Backend tests are blocking; Docker build/publish and production deployment are dependent on successful validation on the main branch.

### Security and reliability

- Secrets are supplied through environment configuration rather than source code.
- Passwords are hashed with bcrypt.
- JWT access and refresh tokens have explicit expiry values.
- Database sessions rollback on exceptions and close in a `finally` block.
- Docker services use health checks and dependency conditions.
- Changes should pass automated tests before merge.

## Project Modules

1. Authentication and authorization
2. Market data collection
3. Data cleaning and validation
4. Feature engineering
5. Market health scoring
6. NSE/BSE comparison
7. Market regime classification
8. Risk and stress analysis
9. Explainable AI analysis
10. Dashboard and reporting

## Local Deployment

```bash
cp .env.example .env
# Configure secrets and service credentials in .env
./scripts/deploy.sh prod
```

The application uses Docker Compose to orchestrate the frontend, backend, PostgreSQL, Redis, Nginx, Celery worker and Celery Beat services.

## Responsible Use

MarketDX is an analytical and educational system. It provides structural market diagnostics and explanations rather than guaranteed price predictions or personalized financial advice.
