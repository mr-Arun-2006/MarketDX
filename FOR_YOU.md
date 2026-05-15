# FOR_YOU.md — MDP v3: What We Upgraded and Why
*Same coffee, sharper conversation.*

---

## Step 1: What was wrong with v2 and what did we fix?

V2 was solid but had one big weakness — it measured the market with blunt instruments. The health engine used VIX and a rough proxy for advance/decline ratio. That gave you a score, but the score was thin. It didn't tell you *why* the market felt the way it did at a technical level.

Here is the specific list of what changed:

**V2 had 4 pillars. V3 has 5.** The new pillar is Momentum (10% weight) — it uses RSI, MACD histogram, and SMA position together. This matters because you can have a low-VIX, calm-looking day where the market is actually losing momentum slowly. V2 would call that "Stable." V3 calls it "Cautious" because RSI is drifting below 50 and price is slipping under SMA-20. That distinction is real and useful.

**V2 had no real technical indicators.** RSI existed but was barely surfaced. MACD, Bollinger Bands, ATR, SMA-50 didn't exist at all. Now all five are computed properly, stored, and displayed with their own dedicated Indicators page.

**V2 had no 30-day history.** Every page showed today's single value. V3 fetches 90 days for warmup, uses 30 for charts, and every chart is a real time-series. Seeing a trend is fundamentally different from seeing a single number.

**V2 had no Bank Nifty.** Bank Nifty leads the broader market. If it's falling 2% while Nifty is down 0.5%, that's a warning V2 would miss entirely. V3 adds it as a standalone indicator and a risk flag trigger.

**V2's A/D proxy used one signal.** Return direction alone determined advance/decline estimate. V3 uses three signals — return direction + RSI level + MACD histogram sign. Three signals beat one every time.

---

## Step 2: Approaches we considered but rejected

**A real ML model (RandomForest/LSTM).** Rejected because it breaks the platform's core promise: Diagnosis, Not Prediction. A black-box model needs a target variable to predict. Our health score is computed deterministically. A rule-based model you can read line by line is more defensible academically than a neural net that says "67" with no reason.

**Redis caching at the API layer.** The right architecture is a 30-second TTL on `/eod` so the first user triggers yfinance and subsequent users get cached results. Rejected for now — it's the correct next upgrade but adds complexity (cache invalidation, TTL tuning) that isn't the bottleneck yet.

**Candlestick charts.** Recharts supports OHLC candlesticks but requires complex custom shape implementations. Line and area charts give cleaner trend visibility for a diagnostic tool and have a smaller bundle size. Kept for a future version.

**A Historical Scores page.** The data model is ready (MarketHealthScore table in models.py). What's missing is the Celery task writing scores to the DB on each fetch. That is intentionally the next milestone — get the pipeline stable first, then persist.

---

## Step 3: How the upgraded parts connect

The computation chain is now longer but cleaner:

```
yfinance (90 days)
    ↓ Module 3: clean — ffill, remove zeros
    ↓ Module 4: feature engineering
         RSI-14 (Wilder smoothing)
         MACD 12-26-9 (EMA via ewm adjust=False)
         Bollinger Bands (20-period, 2σ)
         SMA-20, SMA-50
         ATR-14 (Average True Range)
         Bank Nifty return
         Proxy A/D (3-signal voting)
         History arrays (30 days for charts)
    ↓ Module 5: 5-pillar score (30/25/20/15/10%)
    ↓ Module 6: exchange comparison + Bank Nifty signal
    ↓ Module 7: 6-signal regime voting
    ↓ Module 8: 9-trigger stress score + risk flags
    ↓ Module 9: per-factor XAI explanations with real values
```

The frontend makes three parallel calls using `Promise.allSettled`:
- `/eod` → full health score + exchange comparison
- `/chart` → 30-day history for sparklines
- `/indicators` → technical indicators detail

`allSettled` means if one call fails (e.g. chart data), the dashboard still loads. This is resilience by design.

---

## Step 4: The new indicators — what they actually mean

**RSI-14:** Momentum on 0-100 scale. Above 70 = overbought. Below 30 = oversold. We use Wilder smoothing (the proper method) not simple average — this matters for accuracy at extremes.

**MACD (12,26,9):** Three values — MACD line, signal line, histogram. Histogram crossing from negative to positive = bullish crossover. Parameters 12-26-9 are industry standard. We use `ewm(adjust=False)` to match TradingView and Bloomberg.

**Bollinger Bands (20-period, 2σ):** A band around the 20-day average. `%B` = where price sits in the band (0 to 1). Above 0.95 = near upper band stress. Below 0.05 = oversold compression. SMA-50 = dynamic support level.

**ATR-14:** Average daily price range in rupees, direction-agnostic. High ATR on a flat day means the market swung wildly but closed near the open. Used alongside VIX to refine the Volatility pillar.

**Bank Nifty:** India's financial sector index. When it outperforms Nifty, institutions are confident. When it underperforms by more than 1%, financial stress is spreading — always worth flagging.

---

## Step 5: Tradeoffs made

**90-day fetch vs. faster load.** SMA-50 needs 50 data points minimum. MACD needs 35. We fetch 90 as a safe buffer. This makes cold-start ~2-3 seconds slower. Redis caching fixes this completely when implemented.

**5 pillars, not more.** We could add Stochastic RSI, Williams %R, CCI, OBV. We stopped at 5 because in a diagnostic tool, more indicators after a point reduce clarity without adding insight. Every dashboard metric should be explainable in one sentence.

**`Promise.allSettled` vs `Promise.all`.** `Promise.all` throws if any call fails. `Promise.allSettled` never throws — each result is `{status:'fulfilled',value}` or `{status:'rejected',reason}`. Partial success means the dashboard works even when the chart API is slow or fails. The cost is slightly more verbose result checking code.

**Proxy A/D still not real breadth.** NSE's official breadth data requires API credentials. The 3-signal proxy is meaningfully better than v2's 1-signal version, but it is still an estimate. When you get NSE API access, replace `_proxy_ad()` — everything downstream improves automatically with zero other changes.

---

## Step 6: Bugs and how we fixed them

**`HealthResult.features` serializing large history arrays.** The original design put `f.__dict__` (including 30-item history arrays) into every API response. This added 2KB of redundant data to every call. Fixed: the `/chart` endpoint handles history separately. The main `/eod` endpoint no longer duplicates it.

**MACD histogram bar chart negative values.** Recharts `BarChart` uses `height` as a positive number. Negative values render above the zero line without a custom shape. Fixed with a custom `shape` prop that reads the raw `value`, renders from the zero reference in the correct direction, and colours green/red based on sign.

**Python dataclass mutable defaults.** `List` fields in a dataclass need `field(default_factory=list)` not `= []`. Using `= []` as a default causes all instances to share the same list object — a classic Python gotcha. Fixed in `MarketFeatures` with `field(default_factory=list)` throughout.

**yfinance multi-ticker column structure.** One ticker download: `data["Close"]` is a Series. Multiple tickers: `data["Close"]` is a DataFrame with ticker columns. Our `sr(col, ticker)` helper wraps both cases. Without this, column access silently returns wrong values.

---

## Step 7: Pitfalls to watch next time

**Never call yfinance during market hours for final indicators.** Data for the current day is incomplete until close. The Celery task runs at 4:30PM IST specifically to catch complete EOD data. Manual triggers during trading hours give inaccurate RSI and MACD values.

**`ResponsiveContainer` collapses to zero height without explicit sizing.** If you put it inside a flex container without a pixel height, it renders invisible. Always set `height={number}` on `ResponsiveContainer` or set explicit height on the parent. This is the single most common Recharts debugging issue.

**Check `status === 'fulfilled'` before accessing `.value`.** If `results[0].status === 'rejected'`, then `results[0].value` is `undefined`. Always check status first. Skipping this check produces confusing undefined-access errors that look like data shape problems.

**VIX can return NaN on weekends and holidays.** yfinance returns no VIX data on non-trading days. The `or 15.0` fallback in `_build_features` handles this, but if you change the data pipeline, always preserve the fallback. A NaN VIX propagates into the volatility score and produces a NaN overall score.

---

## Step 8: What an expert would notice in v3

**Wilder RSI smoothing.** Most libraries use simple average gains/losses. We use Wilder's exponential smoothing: `avg_g = (avg_g * (period-1) + new_gain) / period`. This matches Bloomberg, TradingView, and the original Wilder paper. The difference is visible at RSI extremes — Wilder's version is less likely to produce false overbought/oversold signals.

**`ewm(adjust=False)` for MACD.** Pandas' default `adjust=True` uses a correction formula for early periods that diverges from the standard MACD definition. `adjust=False` matches every professional charting platform. Using the wrong setting produces MACD values that look slightly off compared to external references.

**6-signal voting for regime.** V2 used a score threshold. V3 counts 6 binary signals. You need 4 of 6 bullish to get "Bull." This is a consensus model — multiple independent signals agreeing is far more reliable than one signal crossing a threshold. This is how institutional regime models actually work.

**`ReferenceLine` components in every chart.** The RSI chart has lines at 70, 50, 30. VIX has lines at 20, 15. MACD has one at 0. These aren't decoration — they define the zones that give the chart analytical meaning. A diagnostic chart without reference thresholds is just a drawing.

**`Promise.allSettled` over `Promise.all`.** Senior developers immediately recognise this pattern as intentional resilience engineering. It signals the developer thought about partial failures, not just the happy path.

---

## Step 9: Lessons for any project

**Indicators are only as good as their thresholds.** RSI > 70 means "overbought" by convention — it does not predict a fall. In a diagnostic system — medical, financial, infrastructure — indicators tell you where you are in the cycle, not what happens next. Design your system to explain state, not predict future.

**Parallel calls with `Promise.allSettled` beat sequential awaits.** Three sequential 500ms calls = 1500ms total. Three parallel calls = 500ms total. Always identify independent data sources and fetch them in parallel. The partial-success handling is a small code cost for a 3x latency improvement.

**The 90/30 window pattern is universal in time-series.** Fetch more than you display. MACD needs 35 days of warmup. SMA-50 needs 50. But displaying 50 days makes a small chart unreadable. Fetch long, display short. Apply this any time you have windowed computations.

**Custom chart shapes are worth the code.** The MACD histogram needed a custom renderer for negative bars. Without it, the chart was wrong. In recharts — and most charting libraries — the `shape` prop gives you full SVG control while keeping all axis, tooltip, and layout logic. Learn it early and use it whenever the default rendering misbehaves.

**The five-indicator set (RSI, MACD, Bollinger, SMA, ATR) is complete.** These five cover momentum, trend direction, volatility, mean reversion tendency, and price range magnitude. Adding more indicators after these five gives diminishing analytical returns while increasing UI complexity. Know when to stop adding.

*V3 is not more features for the sake of features. It's a more honest model — more signals, better algorithms, real charts, clearer explanations. That is what "effective" means in a diagnostic platform.*
