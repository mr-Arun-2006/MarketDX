#!/usr/bin/env python3
"""
MDP Verification Runner
Runs end-to-end checks on all services and generates a JSON result.
Called by deploy.sh verify command.
"""
import json, sys, time, datetime, os, subprocess, tempfile
from urllib import request, error
from urllib.parse import urlencode

BASE = os.environ.get("MDP_BASE_URL", "http://localhost").strip()
if BASE and not BASE.startswith(("http://", "https://")):
    BASE = "http://" + BASE
BASE = BASE.rstrip("/")
RESULTS = []
PASS = 0
FAIL = 0
WARN = 0
RESULTS_PATH = os.path.join(tempfile.gettempdir(), "mdp_verify_results.json")

def run_cmd(cmd, timeout=5):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        return subprocess.CompletedProcess(
            exc.cmd,
            124,
            stdout=(exc.stdout or ""),
            stderr=(exc.stderr or "") + f"\nTimeout after {timeout}s"
        )
    except FileNotFoundError as exc:
        return subprocess.CompletedProcess(cmd, 127, stdout="", stderr=str(exc))
    except KeyboardInterrupt:
        return subprocess.CompletedProcess(cmd, 130, stdout="", stderr="Command interrupted by user")

# ── Helpers ────────────────────────────────────────────────────
def check(name, category, fn):
    global PASS, FAIL, WARN
    start = time.time()
    try:
        status, detail, extra = fn()
        ms = int((time.time() - start) * 1000)
        if status == "PASS":  PASS += 1
        elif status == "FAIL": FAIL += 1
        else: WARN += 1
        RESULTS.append({
            "name": name, "category": category,
            "status": status, "detail": detail,
            "ms": ms, "extra": extra or {}
        })
        icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
        print(f"  {icon}  [{status:4s}] {name:45s} {ms:>5}ms  {detail}")
    except Exception as e:
        ms = int((time.time() - start) * 1000)
        FAIL += 1
        RESULTS.append({
            "name": name, "category": category,
            "status": "FAIL", "detail": str(e), "ms": ms, "extra": {}
        })
        print(f"  ❌  [FAIL] {name:45s} {ms:>5}ms  {e}")

def GET(path, token=None, timeout=10):
    url = f"{BASE}{path}"
    req = request.Request(url)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())

def POST(path, data, token=None, timeout=15):
    url = f"{BASE}{path}"
    body = json.dumps(data).encode()
    req = request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())

# ── Category 1: Infrastructure ─────────────────────────────────
def section(title):
    print(f"\n  {'─'*60}")
    print(f"  {title}")
    print(f"  {'─'*60}")

section("1. INFRASTRUCTURE — Docker Containers")

def check_docker_service(name, container):
    def fn():
        result = run_cmd(
            ["docker", "inspect", "--format", "{{.State.Status}}", container],
            timeout=5
        )
        status = result.stdout.strip()
        if status == "running":
            # Get uptime
            ts_result = run_cmd(
                ["docker", "inspect", "--format", "{{.State.StartedAt}}", container],
                timeout=5
            )
            started = ts_result.stdout.strip()[:19] if ts_result.stdout else "unknown"
            return "PASS", f"Container running", {"container": container, "started": started}
        if result.returncode != 0 and not status:
            return "FAIL", f"Container not found or docker unavailable: {container} ({result.stderr.strip()})", {}
        return "FAIL", f"Container state: {status or 'unknown'}", {"container": container, "stderr": result.stderr.strip()}
    return fn

for svc, cname in [
    ("Nginx (Reverse Proxy)",  "mdp_nginx"),
    ("FastAPI Backend",        "mdp_backend"),
    ("React Frontend",         "mdp_frontend"),
    ("PostgreSQL Database",    "mdp_postgres"),
    ("Redis Cache",            "mdp_redis"),
    ("Celery Worker",          "mdp_celery_worker"),
    ("Celery Beat Scheduler",  "mdp_celery_beat"),
]:
    check(svc, "Infrastructure", check_docker_service(svc, cname))

# ── Category 2: Network / HTTP ─────────────────────────────────
section("2. NETWORK — HTTP Endpoints")

def chk_health():
    data = GET("/health")
    if data.get("status") == "ok":
        return "PASS", f"API healthy — {data.get('platform','')}", data
    return "FAIL", f"Unexpected response: {data}", {}

def chk_root():
    data = GET("/")
    return "PASS", "Root responds", {"platform": data.get("message","")}

def chk_docs():
    url = f"{BASE}/api/docs"
    req = request.Request(url)
    with request.urlopen(req, timeout=8) as r:
        body = r.read()
        if b"swagger" in body.lower() or b"openapi" in body.lower():
            return "PASS", f"Swagger UI loaded ({len(body)//1024}KB)", {}
        return "WARN", "Docs page loaded but swagger not detected", {}

def chk_frontend():
    url = f"{BASE}/"
    req = request.Request(url)
    with request.urlopen(req, timeout=8) as r:
        body = r.read()
        if b"Market Diagnosis" in body or b"root" in body:
            return "PASS", f"Frontend SPA loaded ({len(body)//1024}KB)", {}
        return "WARN", "Frontend loaded but expected content missing", {}

check("GET /health",         "Network", chk_health)
check("GET / (root)",        "Network", chk_root)
check("GET /api/docs",       "Network", chk_docs)
check("GET / (SPA)",         "Network", chk_frontend)

# ── Category 3: Authentication ─────────────────────────────────
section("3. AUTHENTICATION — User & Admin Flows")

USER_TOKEN = None
ADMIN_TOKEN = None
TEST_EMAIL = f"verify_test_{int(time.time())}@mdp-test.com"

def chk_user_signup():
    data = POST("/api/v1/auth/user/signup", {
        "full_name": "Verify Test User",
        "email": TEST_EMAIL,
        "password": "Test@12345"
    })
    if data.get("message"):
        return "PASS", f"User signed up — ID {data.get('user_id')}", {"user_id": data.get("user_id")}
    return "FAIL", f"Unexpected: {data}", {}

def chk_user_login():
    global USER_TOKEN
    data = POST("/api/v1/auth/user/login", {
        "email": TEST_EMAIL,
        "password": "Test@12345"
    })
    if data.get("access_token"):
        USER_TOKEN = data["access_token"]
        return "PASS", f"User token obtained (role={data.get('role')})", {"role": data.get("role")}
    return "FAIL", f"No token returned: {data}", {}

def chk_admin_login():
    global ADMIN_TOKEN
    try:
        data = POST("/api/v1/auth/admin/login", {
            "email": "admin@mdp.com",
            "password": "Admin@123"
        })
        if data.get("access_token"):
            ADMIN_TOKEN = data["access_token"]
            return "PASS", f"Admin token obtained (role={data.get('role')})", {"role": data.get("role")}
        return "FAIL", f"No token: {data}", {}
    except Exception as e:
        return "WARN", f"Admin login failed (default creds may have changed): {e}", {}

def chk_me_endpoint():
    if not USER_TOKEN:
        return "WARN", "Skipped — no user token", {}
    data = GET("/api/v1/auth/me", token=USER_TOKEN)
    if data.get("email") == TEST_EMAIL:
        return "PASS", f"Me endpoint returns correct user: {data.get('email')}", {"role": data.get("role")}
    return "FAIL", f"Unexpected: {data}", {}

def chk_admin_blocked_for_user():
    if not USER_TOKEN:
        return "WARN", "Skipped — no user token", {}
    try:
        GET("/api/v1/admin/stats", token=USER_TOKEN)
        return "FAIL", "Admin endpoint NOT blocked for regular user — security issue!", {}
    except error.HTTPError as e:
        if e.code == 403:
            return "PASS", "Admin endpoint correctly returns 403 for regular users", {}
        return "WARN", f"Unexpected HTTP {e.code}", {}

def chk_unauth_blocked():
    try:
        GET("/api/v1/market/eod")
        return "FAIL", "Unauthenticated request NOT blocked — security issue!", {}
    except error.HTTPError as e:
        if e.code in (401, 403):
            return "PASS", f"Unauthenticated request blocked with HTTP {e.code}", {}
        return "WARN", f"Unexpected HTTP {e.code}", {}

check("POST /auth/user/signup",           "Auth", chk_user_signup)
check("POST /auth/user/login",            "Auth", chk_user_login)
check("POST /auth/admin/login",           "Auth", chk_admin_login)
check("GET /auth/me (user token)",        "Auth", chk_me_endpoint)
check("Admin route blocked for user",     "Auth", chk_admin_blocked_for_user)
check("Unauthenticated request blocked",  "Auth", chk_unauth_blocked)

# ── Category 4: Market Data Pipeline ──────────────────────────
section("4. MARKET DATA — 10-Module Pipeline")

EOD_DATA = None

def chk_eod():
    global EOD_DATA
    if not USER_TOKEN:
        return "WARN", "Skipped — no user token", {}
    data = GET("/api/v1/market/eod", token=USER_TOKEN)
    EOD_DATA = data
    hs = data.get("health_score", {})
    score = hs.get("overall")
    if score is not None:
        return "PASS", f"EOD loaded — Score {score}/100 · Regime: {hs.get('regime')}", {
            "score": score, "regime": hs.get("regime"),
            "trend": hs.get("trend_signal"), "stress": hs.get("stress_level")
        }
    return "WARN", "EOD returned but no health score (market may be closed)", data

def chk_eod_pillars():
    if not EOD_DATA:
        return "WARN", "Skipped — no EOD data", {}
    pillars = EOD_DATA.get("health_score", {}).get("pillars", {})
    expected = ["volatility", "participation", "stability", "exchange_sync", "momentum"]
    found = [p for p in expected if p in pillars]
    if len(found) == 5:
        scores = [f"{k}={round(v)}" for k,v in pillars.items()]
        return "PASS", f"All 5 pillars present: {', '.join(scores)}", pillars
    return "FAIL", f"Missing pillars: {set(expected)-set(found)}", pillars

def chk_eod_nse():
    if not EOD_DATA:
        return "WARN", "Skipped — no EOD data", {}
    nse = EOD_DATA.get("nse", {})
    if nse.get("nifty_close") and nse.get("vix") and nse.get("rsi"):
        return "PASS", f"NSE data complete — Nifty {nse['nifty_close']:,.2f} VIX {nse['vix']} RSI {nse['rsi']}", {
            "nifty": nse.get("nifty_close"), "vix": nse.get("vix"), "rsi": nse.get("rsi")
        }
    return "WARN", f"NSE data partial: {list(nse.keys())}", nse

def chk_eod_bse():
    if not EOD_DATA:
        return "WARN", "Skipped — no EOD data", {}
    bse = EOD_DATA.get("bse", {})
    if bse.get("sensex_close"):
        return "PASS", f"BSE data complete — Sensex {bse['sensex_close']:,.2f}", {
            "sensex": bse.get("sensex_close"), "advances": bse.get("advances"), "declines": bse.get("declines")
        }
    return "WARN", f"BSE data partial: {list(bse.keys())}", bse

def chk_bank_nifty():
    if not EOD_DATA:
        return "WARN", "Skipped — no EOD data", {}
    bnk = EOD_DATA.get("bank_nifty", {})
    if bnk.get("close"):
        return "PASS", f"Bank Nifty {bnk['close']:,.2f} ({bnk.get('return_pct',0):+.2f}%)", bnk
    return "WARN", "Bank Nifty data missing", bnk

def chk_xai():
    if not EOD_DATA:
        return "WARN", "Skipped — no EOD data", {}
    explains = EOD_DATA.get("health_score", {}).get("explanations", {})
    if len(explains) == 5:
        return "PASS", f"XAI explanations for all 5 pillars generated", {"count": len(explains)}
    return "WARN", f"Only {len(explains)}/5 XAI explanations found", {}

def chk_risk_flags():
    if not EOD_DATA:
        return "WARN", "Skipped — no EOD data", {}
    flags = EOD_DATA.get("health_score", {}).get("risk_flags", [])
    return "PASS", f"{len(flags)} risk flag(s) evaluated", {"flags": flags[:3]}

def chk_exchange_comparison():
    if not EOD_DATA:
        return "WARN", "Skipped — no EOD data", {}
    exc = EOD_DATA.get("exchange_comparison", {})
    if exc.get("stronger_exchange") and exc.get("analysis"):
        return "PASS", f"Exchange comparison complete — {exc.get('stronger_exchange')} stronger today", {
            "nse_ret": exc.get("nse_return"), "bse_ret": exc.get("bse_return")
        }
    return "WARN", "Exchange comparison partial", exc

def chk_chart_endpoint():
    if not USER_TOKEN:
        return "WARN", "Skipped — no user token", {}
    data = GET("/api/v1/market/chart", token=USER_TOKEN)
    if data.get("nse") and len(data.get("nse", [])) > 0:
        return "PASS", f"Chart data: {len(data['nse'])} trading days of history", {"days": len(data["nse"])}
    return "WARN", "Chart data empty (may be market holiday period)", {}

def chk_indicators_endpoint():
    if not USER_TOKEN:
        return "WARN", "Skipped — no user token", {}
    data = GET("/api/v1/market/indicators", token=USER_TOKEN)
    checks = ["rsi", "macd", "bollinger", "moving_averages", "atr"]
    found = [k for k in checks if k in data]
    if len(found) == 5:
        rsi = data.get("rsi", {}).get("value", "?")
        macd_h = data.get("macd", {}).get("histogram", "?")
        return "PASS", f"All indicators present — RSI {rsi} MACD-hist {macd_h}", {"indicators": found}
    return "WARN", f"Only {found}/{checks} indicators returned", {}

def chk_summary_endpoint():
    if not USER_TOKEN:
        return "WARN", "Skipped — no user token", {}
    data = GET("/api/v1/market/summary", token=USER_TOKEN)
    if data.get("score") and data.get("regime"):
        return "PASS", f"Summary: Score {data['score']}/100 Regime {data['regime']}", data
    return "WARN", "Summary partial", data

check("GET /market/eod (full pipeline)",      "Market", chk_eod)
check("5-pillar scores present",              "Market", chk_eod_pillars)
check("NSE data + VIX + RSI",                "Market", chk_eod_nse)
check("BSE data + breadth",                  "Market", chk_eod_bse)
check("Bank Nifty sector signal",            "Market", chk_bank_nifty)
check("XAI explanations (Module 9)",         "Market", chk_xai)
check("Risk flags (Module 8)",               "Market", chk_risk_flags)
check("Exchange comparison (Module 6)",      "Market", chk_exchange_comparison)
check("GET /market/chart (30-day history)",  "Market", chk_chart_endpoint)
check("GET /market/indicators (RSI+MACD+BB)","Market", chk_indicators_endpoint)
check("GET /market/summary",                 "Market", chk_summary_endpoint)

# ── Category 5: AI Service ─────────────────────────────────────
section("5. AI SERVICE — Gemini Integration")

def chk_ai_chat():
    if not USER_TOKEN:
        return "WARN", "Skipped — no user token", {}
    try:
        data = POST("/api/v1/ai/chat",
                    {"message": "What is market health score in simple terms?"},
                    token=USER_TOKEN)
        reply = data.get("reply", "")
        ctx_loaded = data.get("context_loaded", False)
        if reply and len(reply) > 20:
            return "PASS", f"AI replied ({len(reply)} chars) · Context loaded: {ctx_loaded}", {
                "reply_len": len(reply), "context_loaded": ctx_loaded,
                "preview": reply[:80] + "..."
            }
        return "WARN", "AI reply too short or empty (check GEMINI_API_KEY)", {"reply": reply}
    except Exception as e:
        return "WARN", f"AI chat error (check GEMINI_API_KEY in .env): {e}", {}

def chk_ai_report():
    if not USER_TOKEN:
        return "WARN", "Skipped — no user token", {}
    try:
        data = GET("/api/v1/market/report", token=USER_TOKEN)
        narrative = data.get("narrative", "")
        findings = data.get("key_findings", [])
        gen_by = data.get("generated_by", "unknown")
        if len(narrative) > 100:
            return "PASS", f"Report generated by {gen_by} · {len(narrative)} chars · {len(findings)} findings", {
                "generated_by": gen_by, "narrative_len": len(narrative),
                "findings_count": len(findings), "regime_summary": data.get("regime_summary")
            }
        return "WARN", f"Report short or fallback — generated_by: {gen_by}", {"narrative": narrative[:100]}
    except Exception as e:
        return "WARN", f"Report endpoint error: {e}", {}

check("POST /ai/chat (Gemini)",           "AI", chk_ai_chat)
check("GET /market/report (AI narrative)","AI", chk_ai_report)

# ── Category 6: Admin ─────────────────────────────────────────
section("6. ADMIN — Management Endpoints")

def chk_admin_stats():
    if not ADMIN_TOKEN:
        return "WARN", "Skipped — no admin token", {}
    data = GET("/api/v1/admin/stats", token=ADMIN_TOKEN)
    if data.get("total_users") is not None:
        return "PASS", f"Stats: {data['total_users']} users, {data['active_users']} active, {data['total_admins']} admins", data
    return "FAIL", f"Unexpected: {data}", {}

def chk_admin_users():
    if not ADMIN_TOKEN:
        return "WARN", "Skipped — no admin token", {}
    data = GET("/api/v1/admin/users", token=ADMIN_TOKEN)
    if isinstance(data, list):
        return "PASS", f"{len(data)} users in system", {"count": len(data)}
    return "FAIL", f"Expected list, got: {type(data)}", {}

check("GET /admin/stats",  "Admin", chk_admin_stats)
check("GET /admin/users",  "Admin", chk_admin_users)

# ── Category 7: Performance ────────────────────────────────────
section("7. PERFORMANCE — Response Times")

def chk_perf(path, name, token=None, threshold_ms=3000):
    def fn():
        start = time.time()
        GET(path, token=token)
        ms = int((time.time()-start)*1000)
        if ms < 1000:
            return "PASS", f"{ms}ms — excellent", {"ms": ms}
        elif ms < threshold_ms:
            return "PASS", f"{ms}ms — acceptable", {"ms": ms}
        else:
            return "WARN", f"{ms}ms — slow (>{threshold_ms}ms threshold)", {"ms": ms}
    return fn

if USER_TOKEN:
    check("Health endpoint speed",      "Performance", chk_perf("/health", "health"))
    check("EOD endpoint speed",         "Performance", chk_perf("/api/v1/market/eod", "eod", USER_TOKEN, 5000))
    check("Summary endpoint speed",     "Performance", chk_perf("/api/v1/market/summary", "summary", USER_TOKEN, 5000))
    check("Indicators endpoint speed",  "Performance", chk_perf("/api/v1/market/indicators", "indicators", USER_TOKEN, 5000))

# ── Save results ───────────────────────────────────────────────
total = PASS + FAIL + WARN
output = {
    "timestamp": datetime.datetime.now().isoformat(),
    "base_url": BASE,
    "summary": {
        "total": total, "pass": PASS, "fail": FAIL, "warn": WARN,
        "pass_rate": round(PASS/total*100, 1) if total > 0 else 0,
        "overall": "PASS" if FAIL == 0 else "FAIL"
    },
    "results": RESULTS
}

with open(RESULTS_PATH, "w") as f:
    json.dump(output, f, indent=2)

print(f"\n  {'═'*60}")
print(f"  VERIFICATION COMPLETE")
print(f"  {'═'*60}")
print(f"  Total: {total}  ✅ Pass: {PASS}  ❌ Fail: {FAIL}  ⚠️  Warn: {WARN}")
print(f"  Pass Rate: {output['summary']['pass_rate']}%")
print(f"  Overall: {'✅ ALL SYSTEMS GO' if FAIL==0 else '❌ ISSUES FOUND — check report'}")
print(f"  Results saved → {RESULTS_PATH}")
print()

sys.exit(0 if FAIL == 0 else 1)
