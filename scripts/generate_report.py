#!/usr/bin/env python3
"""
MDP Report Generator
Reads /tmp/mdp_verify_results.json and produces a beautiful HTML report.
"""
import json, sys, os, datetime

INPUT  = "/tmp/mdp_verify_results.json"
OUTPUT = os.environ.get("MDP_REPORT_PATH", "/tmp/mdp_report.html")

if not os.path.exists(INPUT):
    print("❌ No verification results found. Run verify first.")
    sys.exit(1)

with open(INPUT) as f:
    data = json.load(f)

summary   = data["summary"]
results   = data["results"]
timestamp = data["timestamp"]
base_url  = data.get("base_url", "http://localhost")

# Group by category
from collections import defaultdict
by_cat = defaultdict(list)
for r in results:
    by_cat[r["category"]].append(r)

# Category icons
CAT_ICON = {
    "Infrastructure": "🐳",
    "Network":        "🌐",
    "Auth":           "🔐",
    "Market":         "📊",
    "AI":             "🤖",
    "Admin":          "🛡️",
    "Performance":    "⚡",
}

STATUS_COLOR = {"PASS": "#10b981", "FAIL": "#ef4444", "WARN": "#f59e0b"}
STATUS_BG    = {"PASS": "#f0fdf4", "FAIL": "#fef2f2", "WARN": "#fffbeb"}
STATUS_ICON  = {"PASS": "✅", "FAIL": "❌", "WARN": "⚠️"}

overall_color = "#10b981" if summary["overall"] == "PASS" else "#ef4444"
overall_icon  = "✅" if summary["overall"] == "PASS" else "❌"

# Build category summary rows
cat_rows = ""
for cat, items in by_cat.items():
    p = sum(1 for i in items if i["status"]=="PASS")
    f = sum(1 for i in items if i["status"]=="FAIL")
    w = sum(1 for i in items if i["status"]=="WARN")
    cat_status = "PASS" if f == 0 else "FAIL"
    cat_rows += f"""
    <tr>
      <td style="padding:10px 16px;font-weight:600;">{CAT_ICON.get(cat,'📌')} {cat}</td>
      <td style="padding:10px 16px;text-align:center;">{len(items)}</td>
      <td style="padding:10px 16px;text-align:center;color:#10b981;font-weight:700;">{p}</td>
      <td style="padding:10px 16px;text-align:center;color:#ef4444;font-weight:700;">{f}</td>
      <td style="padding:10px 16px;text-align:center;color:#f59e0b;font-weight:700;">{w}</td>
      <td style="padding:10px 16px;text-align:center;">
        <span style="padding:3px 12px;border-radius:12px;font-size:12px;font-weight:700;
          background:{STATUS_BG[cat_status]};color:{STATUS_COLOR[cat_status]};
          border:1px solid {STATUS_COLOR[cat_status]}44;">{cat_status}</span>
      </td>
    </tr>"""

# Build detail rows
detail_sections = ""
for cat, items in by_cat.items():
    rows = ""
    for i, r in enumerate(items):
        sc = STATUS_COLOR[r["status"]]
        sb = STATUS_BG[r["status"]]
        extra_html = ""
        if r.get("extra"):
            extra_items = []
            for k, v in r["extra"].items():
                if isinstance(v, list):
                    v = ", ".join(str(x) for x in v[:3])
                extra_items.append(f"<code style='background:#f3f4f6;padding:1px 6px;border-radius:4px;font-size:11px;'>{k}={v}</code>")
            if extra_items:
                extra_html = f"<div style='margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;'>{''.join(extra_items)}</div>"

        rows += f"""
        <tr style="background:{'#fafafa' if i%2==0 else '#fff'};border-bottom:1px solid #f3f4f6;">
          <td style="padding:12px 16px;width:40px;text-align:center;font-size:16px;">{STATUS_ICON[r['status']]}</td>
          <td style="padding:12px 16px;">
            <div style="font-weight:600;color:#1e1b4b;font-size:14px;">{r['name']}</div>
            <div style="font-size:13px;color:#6b7280;margin-top:3px;">{r['detail']}</div>
            {extra_html}
          </td>
          <td style="padding:12px 16px;text-align:center;white-space:nowrap;">
            <span style="font-size:12px;color:#6b7280;">{r['ms']}ms</span>
          </td>
          <td style="padding:12px 16px;text-align:center;">
            <span style="padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700;
              background:{sb};color:{sc};border:1px solid {sc}44;">{r['status']}</span>
          </td>
        </tr>"""

    cat_p = sum(1 for i in items if i["status"]=="PASS")
    cat_f = sum(1 for i in items if i["status"]=="FAIL")

    detail_sections += f"""
    <div style="margin-bottom:32px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:17px;font-weight:800;color:#4c1d95;margin:0;">
          {CAT_ICON.get(cat,'📌')} {cat}
        </h3>
        <span style="font-size:12px;color:#6b7280;">{cat_p}/{len(items)} passed</span>
      </div>
      <div style="background:#fff;border-radius:12px;border:1px solid #ddd6fe;overflow:hidden;box-shadow:0 1px 8px rgba(109,40,217,0.08);">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f5f3ff;border-bottom:2px solid #ddd6fe;">
              <th style="padding:10px 16px;font-size:11px;color:#7c3aed;font-weight:700;letter-spacing:0.06em;width:40px;"></th>
              <th style="padding:10px 16px;font-size:11px;color:#7c3aed;font-weight:700;letter-spacing:0.06em;text-align:left;">CHECK</th>
              <th style="padding:10px 16px;font-size:11px;color:#7c3aed;font-weight:700;letter-spacing:0.06em;">TIME</th>
              <th style="padding:10px 16px;font-size:11px;color:#7c3aed;font-weight:700;letter-spacing:0.06em;">STATUS</th>
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>"""

# EOD snapshot if available
eod_snapshot = ""
eod_result = next((r for r in results if "EOD" in r["name"] and r["status"] == "PASS" and r.get("extra")), None)
if eod_result and eod_result.get("extra"):
    ex = eod_result["extra"]
    score = ex.get("score", "—")
    regime = ex.get("regime", "—")
    trend = ex.get("trend", "—")
    stress = ex.get("stress", "—")
    score_color = "#10b981" if isinstance(score, (int,float)) and score >= 65 else "#f59e0b" if isinstance(score, (int,float)) and score >= 40 else "#ef4444"
    eod_snapshot = f"""
    <div style="background:#fff;border-radius:12px;border:1px solid #ddd6fe;padding:24px;margin-bottom:32px;box-shadow:0 1px 8px rgba(109,40,217,0.08);">
      <h3 style="font-size:17px;font-weight:800;color:#4c1d95;margin:0 0 16px;">📊 Live Market Snapshot (from Verification)</h3>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;">
        <div style="text-align:center;padding:16px;background:#f5f3ff;border-radius:10px;border:1px solid #ede9fe;">
          <div style="font-size:11px;color:#7c3aed;font-weight:700;margin-bottom:6px;">HEALTH SCORE</div>
          <div style="font-size:32px;font-weight:800;color:{score_color};">{score}</div>
          <div style="font-size:11px;color:#9ca3af;">/ 100</div>
        </div>
        <div style="text-align:center;padding:16px;background:#f5f3ff;border-radius:10px;border:1px solid #ede9fe;">
          <div style="font-size:11px;color:#7c3aed;font-weight:700;margin-bottom:6px;">REGIME</div>
          <div style="font-size:22px;font-weight:800;color:#1e1b4b;">{regime}</div>
        </div>
        <div style="text-align:center;padding:16px;background:#f5f3ff;border-radius:10px;border:1px solid #ede9fe;">
          <div style="font-size:11px;color:#7c3aed;font-weight:700;margin-bottom:6px;">TREND SIGNAL</div>
          <div style="font-size:22px;font-weight:800;color:{'#10b981' if trend=='Bullish' else '#ef4444' if trend=='Bearish' else '#f59e0b'};">{trend}</div>
        </div>
        <div style="text-align:center;padding:16px;background:#f5f3ff;border-radius:10px;border:1px solid #ede9fe;">
          <div style="font-size:11px;color:#7c3aed;font-weight:700;margin-bottom:6px;">STRESS LEVEL</div>
          <div style="font-size:32px;font-weight:800;color:{'#ef4444' if isinstance(stress,(int,float)) and stress>6 else '#1e1b4b'};">{stress}</div>
          <div style="font-size:11px;color:#9ca3af;">/ 10</div>
        </div>
      </div>
    </div>"""

# Donut SVG for pass rate
pr = summary["pass_rate"]
circumference = 2 * 3.14159 * 40
offset = circumference * (1 - pr/100)
donut_color = "#10b981" if pr >= 80 else "#f59e0b" if pr >= 60 else "#ef4444"

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>MDP Verification Report</title>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    * {{ margin:0;padding:0;box-sizing:border-box; }}
    body {{ font-family:'Nunito','Abadi MT Condensed',sans-serif;background:#f5f3ff;color:#1e1b4b;-webkit-font-smoothing:antialiased; }}
    @media print {{
      body {{ background:#fff; }}
      .no-print {{ display:none; }}
    }}
  </style>
</head>
<body>

<!-- HEADER -->
<div style="background:linear-gradient(135deg,#4c1d95 0%,#6d28d9 60%,#7c3aed 100%);padding:40px 48px;color:#fff;">
  <div style="max-width:960px;margin:0 auto;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div>
        <div style="font-size:13px;opacity:0.6;letter-spacing:0.1em;margin-bottom:8px;">VERIFICATION &amp; DEPLOYMENT REPORT</div>
        <h1 style="font-size:32px;font-weight:800;margin-bottom:6px;">🩺 Market Diagnosis Platform</h1>
        <p style="font-size:15px;opacity:0.75;">NSE &amp; BSE · 5-Pillar Analysis · Explainable AI · Docker Deployment</p>
      </div>
      <div style="text-align:right;opacity:0.75;font-size:13px;">
        <div style="font-weight:700;margin-bottom:4px;">{timestamp[:10]}</div>
        <div>{timestamp[11:19]} IST</div>
        <div style="margin-top:8px;">{base_url}</div>
      </div>
    </div>
    <!-- overall badge -->
    <div style="margin-top:28px;display:inline-flex;align-items:center;gap:10px;
      background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);
      border-radius:50px;padding:8px 20px;">
      <span style="font-size:20px;">{overall_icon}</span>
      <span style="font-weight:800;font-size:16px;">
        {'ALL SYSTEMS GO — READY TO DEPLOY' if summary["overall"]=="PASS" else 'ISSUES FOUND — REVIEW REQUIRED'}
      </span>
    </div>
  </div>
</div>

<!-- SUMMARY CARDS -->
<div style="max-width:960px;margin:32px auto;padding:0 24px;">

  <div style="display:grid;grid-template-columns:180px 1fr;gap:24px;margin-bottom:32px;">
    <!-- Pass rate donut -->
    <div style="background:#fff;border-radius:16px;border:1px solid #ddd6fe;padding:24px;text-align:center;box-shadow:0 1px 8px rgba(109,40,217,0.08);">
      <div style="font-size:11px;color:#7c3aed;font-weight:700;letter-spacing:0.08em;margin-bottom:16px;">PASS RATE</div>
      <svg width="100" height="100" style="margin:0 auto;display:block;">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#ede9fe" stroke-width="10"/>
        <circle cx="50" cy="50" r="40" fill="none" stroke="{donut_color}" stroke-width="10"
          stroke-dasharray="{circumference:.1f}" stroke-dashoffset="{offset:.1f}"
          stroke-linecap="round" transform="rotate(-90 50 50)"/>
        <text x="50" y="55" text-anchor="middle" font-size="18" font-weight="800" fill="{donut_color}" font-family="Nunito">{pr}%</text>
      </svg>
      <div style="font-size:13px;color:#6b7280;margin-top:12px;">{summary['pass']}/{summary['total']} checks</div>
    </div>

    <!-- Stats grid -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
      {f'''
      <div style="background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0;padding:20px;text-align:center;">
        <div style="font-size:11px;color:#16a34a;font-weight:700;letter-spacing:0.06em;margin-bottom:8px;">✅ PASSED</div>
        <div style="font-size:40px;font-weight:800;color:#15803d;line-height:1;">{summary['pass']}</div>
        <div style="font-size:12px;color:#16a34a;margin-top:4px;">checks passed</div>
      </div>
      <div style="background:#fef2f2;border-radius:12px;border:1px solid #fecaca;padding:20px;text-align:center;">
        <div style="font-size:11px;color:#dc2626;font-weight:700;letter-spacing:0.06em;margin-bottom:8px;">❌ FAILED</div>
        <div style="font-size:40px;font-weight:800;color:#b91c1c;line-height:1;">{summary['fail']}</div>
        <div style="font-size:12px;color:#dc2626;margin-top:4px;">checks failed</div>
      </div>
      <div style="background:#fffbeb;border-radius:12px;border:1px solid #fde68a;padding:20px;text-align:center;">
        <div style="font-size:11px;color:#d97706;font-weight:700;letter-spacing:0.06em;margin-bottom:8px;">⚠️ WARNINGS</div>
        <div style="font-size:40px;font-weight:800;color:#b45309;line-height:1;">{summary['warn']}</div>
        <div style="font-size:12px;color:#d97706;margin-top:4px;">need attention</div>
      </div>
      '''}
    </div>
  </div>

  <!-- Category summary table -->
  <div style="background:#fff;border-radius:12px;border:1px solid #ddd6fe;overflow:hidden;margin-bottom:32px;box-shadow:0 1px 8px rgba(109,40,217,0.08);">
    <div style="background:#f5f3ff;padding:14px 16px;border-bottom:2px solid #ddd6fe;">
      <h3 style="font-size:14px;font-weight:800;color:#4c1d95;">Category Summary</h3>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#faf9ff;">
          <th style="padding:10px 16px;font-size:11px;color:#7c3aed;font-weight:700;letter-spacing:0.06em;text-align:left;">CATEGORY</th>
          <th style="padding:10px 16px;font-size:11px;color:#7c3aed;font-weight:700;letter-spacing:0.06em;text-align:center;">TOTAL</th>
          <th style="padding:10px 16px;font-size:11px;color:#10b981;font-weight:700;letter-spacing:0.06em;text-align:center;">PASS</th>
          <th style="padding:10px 16px;font-size:11px;color:#ef4444;font-weight:700;letter-spacing:0.06em;text-align:center;">FAIL</th>
          <th style="padding:10px 16px;font-size:11px;color:#f59e0b;font-weight:700;letter-spacing:0.06em;text-align:center;">WARN</th>
          <th style="padding:10px 16px;font-size:11px;color:#7c3aed;font-weight:700;letter-spacing:0.06em;text-align:center;">STATUS</th>
        </tr>
      </thead>
      <tbody>{cat_rows}</tbody>
    </table>
  </div>

  <!-- Live market snapshot -->
  {eod_snapshot}

  <!-- Detailed results -->
  <h2 style="font-size:20px;font-weight:800;color:#4c1d95;margin-bottom:20px;">Detailed Check Results</h2>
  {detail_sections}

  <!-- Failed checks callout -->
  {''.join([
    f"""<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px;margin-bottom:12px;">
      <div style="font-weight:700;color:#dc2626;margin-bottom:4px;">❌ {r['name']}</div>
      <div style="font-size:14px;color:#991b1b;">{r['detail']}</div>
    </div>"""
    for r in results if r["status"] == "FAIL"
  ]) if summary['fail'] > 0 else ''}

  <!-- Footer -->
  <div style="border-top:2px solid #ddd6fe;margin-top:40px;padding-top:24px;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-size:13px;color:#9ca3af;">
      Market Diagnosis Platform · NSE &amp; BSE · Explainable AI<br/>
      Department of Computer Science &amp; Engineering
    </div>
    <div style="font-size:12px;color:#9ca3af;text-align:right;">
      Verified: {timestamp[:19]}<br/>
      Report generated by MDP Verify v3
    </div>
  </div>

  <div style="height:40px;"></div>
</div>

</body>
</html>"""

with open(OUTPUT, "w") as f:
    f.write(html)

print(f"✅ HTML report saved → {OUTPUT}")
