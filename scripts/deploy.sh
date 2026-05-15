#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
#  Market Diagnosis Platform v3 — Deploy Script
#  Usage: ./scripts/deploy.sh [command]
# ════════════════════════════════════════════════════════════════
set -e

C='\033[0;36m'; G='\033[0;32m'; Y='\033[1;33m'
R='\033[0;31m'; B='\033[0;35m'; N='\033[0m'

log()  { echo -e "${C}[MDP]${N} $1"; }
ok()   { echo -e "${G}[OK]${N} $1"; }
warn() { echo -e "${Y}[WARN]${N} $1"; }
err()  { echo -e "${R}[ERR]${N} $1"; exit 1; }
step() { echo -e "\n${B}▶ $1${N}"; }

# ── Preflight ─────────────────────────────────────────────────
check_deps() {
  command -v docker >/dev/null 2>&1 || err "Docker not found → https://docs.docker.com/get-docker/"
  docker compose version >/dev/null 2>&1 || err "Docker Compose v2 required"
  ok "Docker + Compose ready"
}

setup_env() {
  if [ ! -f ".env" ]; then
    warn ".env not found — copying .env.example"
    cp .env.example .env
    warn "⚠️  Edit .env and set: SECRET_KEY, DB passwords, GEMINI_API_KEY"
  else
    ok ".env found"
  fi
}

banner() {
  echo ""
  echo -e "${B}  ╔══════════════════════════════════════════╗"
  echo -e "  ║   Market Diagnosis Platform  v3.0       ║"
  echo -e "  ║   NSE & BSE | 5-Pillar | AI | Docker    ║"
  echo -e "  ╚══════════════════════════════════════════╝${N}"
  echo ""
}

wait_healthy() {
  local service=$1
  local max=30
  local i=0
  log "Waiting for $service to be healthy…"
  while [ $i -lt $max ]; do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' "mdp_$service" 2>/dev/null || echo "starting")
    if [ "$STATUS" = "healthy" ]; then
      ok "$service is healthy"
      return 0
    fi
    sleep 3
    i=$((i+1))
    echo -n "."
  done
  echo ""
  warn "$service health check timed out (may still be starting)"
}

# ── Commands ──────────────────────────────────────────────────

cmd_prod() {
  banner
  check_deps
  setup_env
  step "Building and starting all 7 services…"
  docker compose up --build -d
  echo ""
  ok "🎉 Platform is live!"
  echo ""
  echo -e "  ${G}User Dashboard:${N}    http://localhost"
  echo -e "  ${G}User Signup:${N}       http://localhost/signup"
  echo -e "  ${G}Admin Portal:${N}      http://localhost/login/admin"
  echo -e "  ${G}API Docs:${N}          http://localhost/api/docs"
  echo -e "  ${G}Health Check:${N}      http://localhost/health"
  echo ""
  echo -e "  ${Y}Default admin:${N}     admin@mdp.com / Admin@123"
  echo -e "  ${Y}⚠️  Change password${N} immediately after first login!"
  echo ""
  echo -e "  Run verification:  ${C}./scripts/deploy.sh verify${N}"
  echo ""
}

cmd_dev() {
  banner
  setup_env
  step "Starting in DEV mode (hot reload)…"
  docker compose up --build -d postgres redis
  log "Waiting for database…"; sleep 6
  docker compose up --build backend celery_worker celery_beat
}

cmd_down()    { docker compose down;                      ok "All services stopped"; }
cmd_logs()    { docker compose logs -f --tail=120 ${2:-""}; }
cmd_status()  { docker compose ps; }
cmd_migrate() { log "Running DB migrations…"; docker compose exec backend alembic upgrade head; ok "Done"; }
cmd_shell()   { docker compose exec backend bash; }
cmd_restart() { docker compose restart ${2:-""}; ok "Restarted"; }

cmd_seed_admin() {
  log "Seeding default admin account…"
  docker compose exec backend python3 -c "
import asyncio
from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.models import User, UserRole
from sqlalchemy import select

async def seed():
    async with AsyncSessionLocal() as db:
        r = await db.execute(select(User).where(User.role == UserRole.ADMIN))
        if r.scalar_one_or_none():
            print('Admin already exists — no changes made')
            return
        admin = User(full_name='Super Admin', email='admin@mdp.com',
                     hashed_password=hash_password('Admin@123'),
                     role=UserRole.ADMIN, is_active=True)
        db.add(admin)
        await db.commit()
        print('✅ Admin seeded: admin@mdp.com / Admin@123')

asyncio.run(seed())
"
}

# ══════════════════════════════════════════════════════════════
#  VERIFY — Run all checks and generate HTML report
# ══════════════════════════════════════════════════════════════
cmd_verify() {
  banner
  echo -e "${B}  VERIFICATION & DEPLOYMENT REPORT${N}"
  echo -e "  Running end-to-end checks on all services…"
  echo ""

  # ── Step 1: Check containers ─────────────────────────────
  step "Step 1 of 5 — Checking Docker containers are running"
  SERVICES=(mdp_nginx mdp_backend mdp_frontend mdp_postgres mdp_redis mdp_celery_worker mdp_celery_beat)
  ALL_UP=true
  for svc in "${SERVICES[@]}"; do
    STATUS=$(docker inspect --format='{{.State.Status}}' "$svc" 2>/dev/null || echo "not_found")
    if [ "$STATUS" = "running" ]; then
      ok "  $svc → running"
    else
      warn "  $svc → $STATUS"
      ALL_UP=false
    fi
  done

  if [ "$ALL_UP" = false ]; then
    warn "Some containers are not running. Starting them now…"
    docker compose up -d
    log "Waiting 15s for services to stabilise…"
    sleep 15
  fi

  # ── Step 2: Wait for backend health ──────────────────────
  step "Step 2 of 5 — Waiting for API to be ready"
  MAX=20; I=0
  while [ $I -lt $MAX ]; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
      ok "API is responding (HTTP 200)"
      break
    fi
    echo -n "  Waiting… ($HTTP_CODE) "
    sleep 4
    I=$((I+1))
    echo ""
  done

  if [ "$HTTP_CODE" != "200" ]; then
    warn "API not responding after timeout — check logs: ./scripts/deploy.sh logs backend"
  fi

  # ── Step 3: Run Python verification suite ────────────────
  step "Step 3 of 5 — Running verification suite (47 checks)"
  echo ""

  # Determine where Python is available
  PYTHON_CMD=""
  if docker compose exec -T backend python3 --version >/dev/null 2>&1; then
    log "Running verification inside backend container…"
    docker compose cp ./scripts/verify_runner.py backend:/tmp/verify_runner.py 2>/dev/null || \
      docker compose exec -T backend bash -c "cat > /tmp/verify_runner.py" < ./scripts/verify_runner.py
    docker compose exec -T -e MDP_BASE_URL=http://nginx \
      backend python3 /tmp/verify_runner.py
    VERIFY_EXIT=$?
    # Copy results out
    docker compose exec -T backend cat /tmp/mdp_verify_results.json > /tmp/mdp_verify_results.json 2>/dev/null || true
  elif command -v python3 >/dev/null 2>&1; then
    log "Running verification on host machine…"
    MDP_BASE_URL=http://localhost python3 ./scripts/verify_runner.py
    VERIFY_EXIT=$?
  else
    warn "Python3 not available — skipping automated checks"
    VERIFY_EXIT=0
  fi

  # ── Step 4: Generate HTML report ─────────────────────────
  step "Step 4 of 5 — Generating HTML verification report"

  REPORT_DIR="./reports"
  TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
  REPORT_FILE="${REPORT_DIR}/mdp_report_${TIMESTAMP}.html"
  mkdir -p "$REPORT_DIR"

  if [ -f "/tmp/mdp_verify_results.json" ]; then
    if command -v python3 >/dev/null 2>&1; then
      MDP_REPORT_PATH="$REPORT_FILE" python3 ./scripts/generate_report.py
      cp "$REPORT_FILE" "${REPORT_DIR}/mdp_report_latest.html"
      ok "HTML report → $REPORT_FILE"
      ok "Latest copy → ${REPORT_DIR}/mdp_report_latest.html"
    else
      # Minimal fallback report
      cat /tmp/mdp_verify_results.json | python3 -c "
import json,sys
d=json.load(sys.stdin)
s=d['summary']
print(f\"Pass: {s['pass']}/{s['total']} | Fail: {s['fail']} | Warn: {s['warn']} | Rate: {s['pass_rate']}%\")
" 2>/dev/null || cat /tmp/mdp_verify_results.json
    fi
  else
    warn "No verification results found — skipping report generation"
  fi

  # ── Step 5: Print final summary ──────────────────────────
  step "Step 5 of 5 — Verification Summary"
  echo ""

  if [ -f "/tmp/mdp_verify_results.json" ] && command -v python3 >/dev/null 2>&1; then
    python3 - << 'PYEOF'
import json
with open("/tmp/mdp_verify_results.json") as f:
    d = json.load(f)
s = d["summary"]
G="\033[0;32m"; R="\033[0;31m"; Y="\033[1;33m"; C="\033[0;36m"; N="\033[0m"; B="\033[0;35m"

print(f"  {'═'*58}")
print(f"  {B}FINAL RESULTS{N}")
print(f"  {'═'*58}")
print(f"  Total Checks : {s['total']}")
print(f"  {G}✅ Passed    : {s['pass']}{N}")
print(f"  {R}❌ Failed    : {s['fail']}{N}")
print(f"  {Y}⚠️  Warnings  : {s['warn']}{N}")
print(f"  Pass Rate    : {s['pass_rate']}%")
print(f"  {'─'*58}")

# Failures
fails = [r for r in d["results"] if r["status"]=="FAIL"]
warns = [r for r in d["results"] if r["status"]=="WARN"]

if fails:
    print(f"\n  {R}FAILED CHECKS:{N}")
    for r in fails:
        print(f"  {R}❌{N} {r['name']}")
        print(f"     → {r['detail']}")

if warns:
    print(f"\n  {Y}WARNINGS:{N}")
    for r in warns[:5]:
        print(f"  {Y}⚠️{N}  {r['name']}")
        print(f"     → {r['detail']}")
    if len(warns) > 5:
        print(f"     ... and {len(warns)-5} more warnings")

print(f"\n  {'═'*58}")
if s["overall"] == "PASS":
    print(f"  {G}✅  ALL SYSTEMS GO — PLATFORM VERIFIED & READY{N}")
else:
    print(f"  {R}❌  ISSUES FOUND — REVIEW FAILED CHECKS ABOVE{N}")
print(f"  {'═'*58}\n")
PYEOF
  fi

  echo ""
  echo -e "  ${C}Platform URLs:${N}"
  echo -e "  User Login  → http://localhost/login/user"
  echo -e "  Admin Login → http://localhost/login/admin"
  echo -e "  API Docs    → http://localhost/api/docs"
  echo ""

  REPORT_LATEST="./reports/mdp_report_latest.html"
  if [ -f "$REPORT_LATEST" ]; then
    echo -e "  ${G}📄 HTML Report:${N} $REPORT_LATEST"
    echo -e "  Open in browser: file://$(pwd)/reports/mdp_report_latest.html"
  fi
  echo ""

  exit ${VERIFY_EXIT:-0}
}

# ── Quick verify (no report, just summary) ────────────────────
cmd_check() {
  log "Quick health check…"
  echo ""

  SERVICES=(nginx backend frontend postgres redis)
  for svc in "${SERVICES[@]}"; do
    STATUS=$(docker inspect --format='{{.State.Status}}' "mdp_$svc" 2>/dev/null || echo "not found")
    COLOR=$G; [ "$STATUS" != "running" ] && COLOR=$R
    echo -e "  ${COLOR}● ${svc}${N} → $STATUS"
  done

  echo ""
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health 2>/dev/null || echo "---")
  if [ "$HTTP" = "200" ]; then
    ok "API health endpoint → HTTP $HTTP ✅"
  else
    warn "API health endpoint → HTTP $HTTP"
  fi

  echo ""
  log "For full verification with HTML report: ./scripts/deploy.sh verify"
  echo ""
}

# ── Router ────────────────────────────────────────────────────
case "${1:-}" in
  prod)        cmd_prod ;;
  dev)         cmd_dev ;;
  down)        cmd_down ;;
  logs)        cmd_logs "$@" ;;
  status)      cmd_status ;;
  migrate)     cmd_migrate ;;
  shell)       cmd_shell ;;
  restart)     cmd_restart "$@" ;;
  seed-admin)  cmd_seed_admin ;;
  verify)      cmd_verify ;;
  check)       cmd_check ;;
  *)
    banner
    echo "  Usage: ./scripts/deploy.sh [command]"
    echo ""
    echo "  ── DEPLOY ───────────────────────────────────────────"
    echo "  prod            Build & start all 7 services (default)"
    echo "  dev             Dev mode with hot reload"
    echo "  down            Stop all services"
    echo "  restart [svc]   Restart one or all services"
    echo ""
    echo "  ── VERIFY & REPORT ──────────────────────────────────"
    echo "  verify          Run full verification (47 checks) + HTML report"
    echo "  check           Quick 30-second health check"
    echo ""
    echo "  ── MANAGE ───────────────────────────────────────────"
    echo "  logs [svc]      Follow logs  (e.g. logs backend)"
    echo "  status          Show container status"
    echo "  migrate         Run database migrations"
    echo "  shell           Open backend Python shell"
    echo "  seed-admin      Seed default admin account"
    echo ""
    echo "  ── EXAMPLES ─────────────────────────────────────────"
    echo "  ./scripts/deploy.sh prod          # deploy everything"
    echo "  ./scripts/deploy.sh verify        # verify + HTML report"
    echo "  ./scripts/deploy.sh check         # quick health check"
    echo "  ./scripts/deploy.sh logs backend  # watch backend logs"
    echo ""
    ;;
esac
