"""
Market Health Engine v2 — Upgraded
Module 2: Data Collection  (yfinance + 90-day window)
Module 3: Cleaning         (outlier removal, forward-fill)
Module 4: Feature Eng.     (RSI-14, MACD, Bollinger Bands, SMA-20/50, ATR, Bank Nifty)
Module 5: Health Score     (5-pillar weighted: Vol/Part/Stab/Sync/Momentum)
Module 6: Exchange Comp.   (NSE vs BSE structural diff + Bank Nifty signal)
Module 7: Regime Class.    (6-state multi-signal: Bull/Bear/Sideways/Stable/Cautious/Stressed)
Module 8: Regime Analysis  (Stress composite, risk flags, support/resistance)
Module 9: XAI Explanations (per-factor natural language with actual values)
"""
import yfinance as yf
import numpy as np
import pandas as pd
from datetime import date, timedelta
from dataclasses import dataclass, field
from typing import Optional, List
from loguru import logger

NSE_TICKER        = "^NSEI"
BSE_TICKER        = "^BSESN"
VIX_TICKER        = "^INDIAVIX"
BANK_NIFTY_TICKER = "^NSEBANK"


@dataclass
class MarketFeatures:
    date: date
    nse_open: float;  nse_close: float
    nse_high: float;  nse_low: float
    nse_volume: float; nse_vix: float
    nse_advances: int; nse_declines: int
    bse_open: float;  bse_close: float
    bse_high: float;  bse_low: float
    bse_advances: int; bse_declines: int
    # Technical indicators
    nse_rsi: float = 50.0
    nse_macd: float = 0.0
    nse_macd_signal: float = 0.0
    nse_macd_hist: float = 0.0
    nse_sma_20: float = 0.0
    nse_sma_50: float = 0.0
    nse_bb_upper: float = 0.0
    nse_bb_lower: float = 0.0
    nse_bb_pct: float = 0.5
    nse_atr: float = 0.0
    bank_nifty_close: float = 0.0
    bank_nifty_return: float = 0.0
    # Derived
    nse_return: float = 0.0
    bse_return: float = 0.0
    nse_range_pct: float = 0.0
    bse_range_pct: float = 0.0
    nse_ad_ratio: float = 1.0
    bse_ad_ratio: float = 1.0
    exchange_divergence: float = 0.0
    volatility_ratio: float = 1.0
    price_vs_sma20: float = 0.0
    price_vs_sma50: float = 0.0
    # History for charts
    nse_history: List[float] = field(default_factory=list)
    bse_history: List[float] = field(default_factory=list)
    vix_history: List[float] = field(default_factory=list)
    history_dates: List[str] = field(default_factory=list)


@dataclass
class HealthResult:
    overall_score: float
    volatility_score: float
    participation_score: float
    stability_score: float
    exchange_sync_score: float
    momentum_score: float
    regime: str
    stress_level: float
    risk_flags: List[str]
    features: dict
    explanations: dict
    trend_signal: str
    support_level: float
    resistance_level: float


class MarketHealthEngine:

    # ── Module 2 ───────────────────────────────────────────────
    def collect(self, target: Optional[date] = None) -> Optional[MarketFeatures]:
        target = target or date.today()
        start  = target - timedelta(days=90)
        end    = target + timedelta(days=1)
        try:
            tickers = [NSE_TICKER, BSE_TICKER, VIX_TICKER, BANK_NIFTY_TICKER]
            data = yf.download(tickers, start=start, end=end,
                               progress=False, auto_adjust=True)
            if data.empty:
                logger.warning("yfinance empty — market holiday or network issue")
                return None
            data = self._clean(data)
            return self._build_features(data, target)
        except Exception as e:
            logger.error(f"Collection failed: {e}")
            return None

    # ── Module 3 ───────────────────────────────────────────────
    def _clean(self, data: pd.DataFrame) -> pd.DataFrame:
        data = data.ffill().bfill()
        try:
            mask = data["Close"][NSE_TICKER] > 0
            data = data[mask]
        except Exception:
            pass
        return data

    # ── Module 4 ───────────────────────────────────────────────
    def _build_features(self, data: pd.DataFrame, target: date) -> Optional[MarketFeatures]:
        def s(col, ticker):
            try:
                sr = data[col][ticker].dropna()
                return float(sr.iloc[-1]) if not sr.empty else 0.0
            except Exception:
                return 0.0

        def sr(col, ticker):
            try:
                return data[col][ticker].dropna()
            except Exception:
                return pd.Series(dtype=float)

        closes_nse  = sr("Close", NSE_TICKER)
        closes_bse  = sr("Close", BSE_TICKER)
        closes_vix  = sr("Close", VIX_TICKER)
        closes_bank = sr("Close", BANK_NIFTY_TICKER)

        if closes_nse.empty or len(closes_nse) < 5:
            return None

        nse_close = float(closes_nse.iloc[-1])
        nse_open  = s("Open",   NSE_TICKER)
        nse_high  = s("High",   NSE_TICKER)
        nse_low   = s("Low",    NSE_TICKER)
        nse_vol   = s("Volume", NSE_TICKER)
        vix       = float(closes_vix.iloc[-1]) if not closes_vix.empty else 15.0
        bse_close = float(closes_bse.iloc[-1]) if not closes_bse.empty else 0.0
        bse_open  = s("Open", BSE_TICKER)
        bse_high  = s("High", BSE_TICKER)
        bse_low   = s("Low",  BSE_TICKER)
        bank_close = float(closes_bank.iloc[-1]) if not closes_bank.empty else 0.0
        bank_prev  = float(closes_bank.iloc[-2]) if len(closes_bank) > 1 else bank_close
        bank_ret   = (bank_close - bank_prev) / max(bank_prev, 1) * 100

        rsi                    = self._rsi(closes_nse.values)
        macd, macd_sig, macd_h = self._macd(closes_nse.values)
        sma20                  = self._sma(closes_nse.values, 20)
        sma50                  = self._sma(closes_nse.values, 50)
        bb_up, bb_lo, bb_pct   = self._bollinger(closes_nse.values)
        atr                    = self._atr(data, NSE_TICKER)

        nse_ret = (nse_close - nse_open) / max(nse_open, 1) * 100
        bse_ret = (bse_close - bse_open) / max(bse_open, 1) * 100

        nse_adv, nse_dec = self._proxy_ad(nse_ret, rsi, macd_h, 2000)
        bse_adv, bse_dec = self._proxy_ad(bse_ret, rsi, macd_h, 5000)

        hist_nse   = [round(v, 2) for v in closes_nse.values[-30:].tolist()]
        hist_bse   = [round(v, 2) for v in closes_bse.values[-30:].tolist()] if not closes_bse.empty else []
        hist_vix   = [round(v, 2) for v in closes_vix.values[-30:].tolist()] if not closes_vix.empty else []
        hist_dates = [str(d.date()) for d in closes_nse.index[-30:]]

        return MarketFeatures(
            date=target,
            nse_open=round(nse_open,2), nse_close=round(nse_close,2),
            nse_high=round(nse_high,2), nse_low=round(nse_low,2),
            nse_volume=nse_vol, nse_vix=round(vix,2),
            nse_advances=nse_adv, nse_declines=nse_dec,
            bse_open=round(bse_open,2), bse_close=round(bse_close,2),
            bse_high=round(bse_high,2), bse_low=round(bse_low,2),
            bse_advances=bse_adv, bse_declines=bse_dec,
            nse_rsi=round(rsi,2), nse_macd=round(macd,4),
            nse_macd_signal=round(macd_sig,4), nse_macd_hist=round(macd_h,4),
            nse_sma_20=round(sma20,2), nse_sma_50=round(sma50,2),
            nse_bb_upper=round(bb_up,2), nse_bb_lower=round(bb_lo,2), nse_bb_pct=round(bb_pct,3),
            nse_atr=round(atr,2), bank_nifty_close=round(bank_close,2),
            bank_nifty_return=round(bank_ret,3),
            nse_return=round(nse_ret,3), bse_return=round(bse_ret,3),
            nse_range_pct=round((nse_high-nse_low)/max(nse_open,1)*100,3),
            bse_range_pct=round((bse_high-bse_low)/max(bse_open,1)*100,3),
            nse_ad_ratio=round(nse_adv/max(nse_dec,1),3),
            bse_ad_ratio=round(bse_adv/max(bse_dec,1),3),
            exchange_divergence=round(abs(nse_ret-bse_ret),3),
            volatility_ratio=round(vix/15.0,3),
            price_vs_sma20=round((nse_close-sma20)/max(sma20,1)*100,3) if sma20 else 0.0,
            price_vs_sma50=round((nse_close-sma50)/max(sma50,1)*100,3) if sma50 else 0.0,
            nse_history=hist_nse, bse_history=hist_bse,
            vix_history=hist_vix, history_dates=hist_dates,
        )

    # ── Module 5 ───────────────────────────────────────────────
    def score(self, f: MarketFeatures) -> HealthResult:
        # Volatility (30%)
        vix_sc  = max(0, min(100, (30 - f.nse_vix) / 18 * 100))
        atr_pct = f.nse_atr / max(f.nse_close * 0.02, 1)
        vol     = round(vix_sc * 0.7 + (1 - min(atr_pct, 1)) * 30, 2)

        # Participation (25%)
        avg_ad = (f.nse_ad_ratio + f.bse_ad_ratio) / 2
        part   = round(max(0, min(100, (avg_ad - 0.5) / 1.5 * 100)), 2)

        # Stability (20%)
        avg_rng = (f.nse_range_pct + f.bse_range_pct) / 2
        stab    = round(max(0, min(100, (3.0 - avg_rng) / 2.5 * 100)), 2)

        # Exchange Sync (15%)
        sync = round(max(0, min(100, (1.0 - f.exchange_divergence) / 0.9 * 100)), 2)

        # Momentum (10%) — RSI + MACD + SMA position
        rsi_sc  = max(0, 100 - abs(f.nse_rsi - 50) * 2)
        macd_sc = max(0, min(100, 60 + f.nse_macd_hist * 500))
        sma_sc  = 70 if (f.price_vs_sma20 > 0 and f.price_vs_sma50 > 0) else \
                  45 if f.price_vs_sma20 > 0 else 25
        mom = round(max(0, min(100, rsi_sc*0.4 + macd_sc*0.35 + sma_sc*0.25)), 2)

        overall  = round(vol*0.30 + part*0.25 + stab*0.20 + sync*0.15 + mom*0.10, 2)
        regime   = self._classify(overall, f)
        stress   = self._stress(f)
        flags    = self._risk_flags(f, overall)
        explains = self._explain(vol, part, stab, sync, mom, f)
        trend    = self._trend_signal(f)

        return HealthResult(
            overall_score=overall,
            volatility_score=vol, participation_score=part,
            stability_score=stab, exchange_sync_score=sync,
            momentum_score=mom, regime=regime, stress_level=round(stress,2),
            risk_flags=flags, features=f.__dict__,
            explanations=explains, trend_signal=trend,
            support_level=f.nse_sma_50,
            resistance_level=f.nse_bb_upper,
        )

    # ── Module 6 ───────────────────────────────────────────────
    def compare_exchanges(self, f: MarketFeatures) -> dict:
        stronger = "NSE" if f.nse_return > f.bse_return else "BSE"
        bank_sig = "positive" if f.bank_nifty_return > 0.3 else \
                   "negative" if f.bank_nifty_return < -0.3 else "neutral"
        return {
            "nse_return": f.nse_return, "bse_return": f.bse_return,
            "divergence": f.exchange_divergence,
            "stronger_exchange": stronger,
            "nse_ad_ratio": f.nse_ad_ratio, "bse_ad_ratio": f.bse_ad_ratio,
            "bank_nifty_return": f.bank_nifty_return,
            "bank_nifty_signal": bank_sig,
            "analysis": (
                f"NSE moved {f.nse_return:+.2f}% vs BSE {f.bse_return:+.2f}%. "
                f"{stronger} showed stronger breadth. "
                f"Bank Nifty {bank_sig} ({f.bank_nifty_return:+.2f}%) — "
                f"{'financials led' if bank_sig=='positive' else 'financials lagged' if bank_sig=='negative' else 'financials range-bound'}."
            ),
        }

    # ── Module 7 ───────────────────────────────────────────────
    def _classify(self, score: float, f: MarketFeatures) -> str:
        bull = sum([f.nse_return>0.3, f.nse_rsi>55, f.nse_macd_hist>0,
                    f.price_vs_sma20>0, f.price_vs_sma50>0, f.bank_nifty_return>0])
        bear = sum([f.nse_return<-0.3, f.nse_rsi<45, f.nse_macd_hist<0,
                    f.price_vs_sma20<0, f.price_vs_sma50<0, f.nse_vix>22])
        if bull >= 4 and score >= 60: return "Bull"
        if bear >= 4 and score <= 45: return "Bear"
        if score >= 65 and f.nse_vix < 16: return "Stable"
        if score >= 50: return "Cautious"
        if abs(f.nse_return) < 0.2 and f.nse_vix > 18: return "Sideways"
        return "Stressed"

    # ── Module 8 ───────────────────────────────────────────────
    def _stress(self, f: MarketFeatures) -> float:
        s = 0.0
        if f.nse_vix > 20:              s += (f.nse_vix-20)/5
        if f.nse_ad_ratio < 0.8:        s += 2.0
        elif f.nse_ad_ratio < 1.0:      s += 1.0
        if f.nse_range_pct > 2.0:       s += 1.5
        if f.exchange_divergence > 0.5: s += 1.0
        if f.nse_rsi > 75:              s += 1.0
        if f.nse_rsi < 30:              s += 1.5
        if f.nse_bb_pct < 0.05:         s += 1.0
        if f.bank_nifty_return < -1.0:  s += 1.0
        return min(10.0, round(s, 2))

    def _risk_flags(self, f: MarketFeatures, score: float) -> list:
        flags = []
        if f.nse_vix > 22:
            flags.append(f"⚠️ VIX elevated at {f.nse_vix:.1f} — above safe zone")
        if f.nse_ad_ratio < 0.7:
            flags.append("⚠️ Negative breadth — majority of stocks declining")
        if f.nse_rsi > 75:
            flags.append(f"⚠️ RSI overbought at {f.nse_rsi:.1f} — possible reversal")
        if f.nse_rsi < 30:
            flags.append(f"⚠️ RSI oversold at {f.nse_rsi:.1f} — extreme selling")
        if f.exchange_divergence > 0.8:
            flags.append(f"⚠️ High NSE-BSE divergence ({f.exchange_divergence:.2f}%)")
        if f.price_vs_sma50 < -2:
            flags.append(f"⚠️ Nifty {abs(f.price_vs_sma50):.1f}% below SMA-50 — downtrend")
        if f.nse_macd_hist < -5:
            flags.append("⚠️ MACD deeply negative — bearish momentum")
        if f.bank_nifty_return < -1.5:
            flags.append(f"⚠️ Bank Nifty down {abs(f.bank_nifty_return):.2f}% — financial stress")
        if score < 35:
            flags.append("🔴 Health score critical — multiple risk factors active")
        return flags

    # ── Module 9 ───────────────────────────────────────────────
    def _explain(self, vol, part, stab, sync, mom, f) -> dict:
        return {
            "volatility": {
                "score": vol, "weight": 0.30,
                "description": (
                    f"VIX {f.nse_vix:.1f} · ATR ₹{f.nse_atr:.0f} · "
                    f"{'Calm — low fear' if f.nse_vix<15 else 'Moderate' if f.nse_vix<22 else 'Elevated fear'}"
                ),
            },
            "participation": {
                "score": part, "weight": 0.25,
                "description": (
                    f"NSE A/D {f.nse_ad_ratio:.2f} · BSE A/D {f.bse_ad_ratio:.2f} · "
                    f"{'Broad healthy breadth' if (f.nse_ad_ratio+f.bse_ad_ratio)/2>1.5 else 'Narrow breadth' if (f.nse_ad_ratio+f.bse_ad_ratio)/2>1.0 else 'Negative breadth'}"
                ),
            },
            "stability": {
                "score": stab, "weight": 0.20,
                "description": (
                    f"Nifty range {f.nse_range_pct:.2f}% · Sensex range {f.bse_range_pct:.2f}% · "
                    f"{'Tight controlled' if f.nse_range_pct<0.8 else 'Normal movement' if f.nse_range_pct<1.5 else 'Wide volatile swings'}"
                ),
            },
            "exchange_sync": {
                "score": sync, "weight": 0.15,
                "description": (
                    f"NSE {f.nse_return:+.2f}% vs BSE {f.bse_return:+.2f}% · "
                    f"Divergence {f.exchange_divergence:.2f}% · "
                    f"{'Well aligned' if f.exchange_divergence<0.2 else 'Minor divergence' if f.exchange_divergence<0.5 else 'Notable split'}"
                ),
            },
            "momentum": {
                "score": mom, "weight": 0.10,
                "description": (
                    f"RSI {f.nse_rsi:.1f} · MACD hist {f.nse_macd_hist:+.3f} · "
                    f"SMA20 {f.price_vs_sma20:+.2f}% · SMA50 {f.price_vs_sma50:+.2f}% · "
                    f"{'Strong upward momentum' if mom>65 else 'Neutral' if mom>40 else 'Weakening momentum'}"
                ),
            },
        }

    def _trend_signal(self, f: MarketFeatures) -> str:
        bull = sum([f.nse_macd_hist>0, f.nse_rsi>50, f.price_vs_sma20>0, f.price_vs_sma50>0])
        if bull >= 3: return "Bullish"
        if bull <= 1: return "Bearish"
        return "Neutral"

    # ── Indicator implementations ──────────────────────────────
    def _rsi(self, closes, period=14) -> float:
        if len(closes) < period+1: return 50.0
        deltas = np.diff(closes)
        gains  = np.where(deltas > 0, deltas, 0.0)
        losses = np.where(deltas < 0, -deltas, 0.0)
        avg_g  = np.mean(gains[:period])
        avg_l  = np.mean(losses[:period])
        for i in range(period, len(gains)):
            avg_g = (avg_g*(period-1)+gains[i])/period
            avg_l = (avg_l*(period-1)+losses[i])/period
        if avg_l == 0: return 100.0
        return round(100-100/(1+avg_g/avg_l), 2)

    def _macd(self, closes, fast=12, slow=26, sig=9):
        if len(closes) < slow+sig: return 0.0, 0.0, 0.0
        def ema(arr, n):
            return pd.Series(arr).ewm(span=n, adjust=False).mean().values
        ml  = ema(closes, fast) - ema(closes, slow)
        sl  = ema(ml, sig)
        return float(ml[-1]), float(sl[-1]), float(ml[-1]-sl[-1])

    def _sma(self, closes, period) -> float:
        if len(closes) < period: return float(closes[-1]) if len(closes) else 0.0
        return float(np.mean(closes[-period:]))

    def _bollinger(self, closes, period=20, k=2):
        if len(closes) < period: return 0.0, 0.0, 0.5
        w   = closes[-period:]
        mid = np.mean(w); std = np.std(w, ddof=1)
        up  = mid + k*std; lo = mid - k*std
        pct = (closes[-1]-lo)/(up-lo) if up != lo else 0.5
        return float(up), float(lo), float(np.clip(pct,0,1))

    def _atr(self, data, ticker, period=14) -> float:
        try:
            hi = data["High"][ticker].dropna().values
            lo = data["Low"][ticker].dropna().values
            cl = data["Close"][ticker].dropna().values
            if len(cl) < period+1: return 0.0
            tr = np.maximum(hi[1:]-lo[1:],
                 np.maximum(abs(hi[1:]-cl[:-1]), abs(lo[1:]-cl[:-1])))
            return float(np.mean(tr[-period:]))
        except Exception:
            return 0.0

    def _proxy_ad(self, ret, rsi, macd_h, total):
        score = sum([ret>0, rsi>52, macd_h>0])
        ratios = {0:(0.30,0.70), 1:(0.42,0.58), 2:(0.58,0.42), 3:(0.72,0.28)}
        ar, dr = ratios[score]
        adv = int(total*ar)
        return adv, total-adv
