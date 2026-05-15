"""
AI Service v2 — Google Gemini
- Richer prompts with all 5 pillars + technical indicators
- Chat with rolling conversation context
- Structured JSON findings extraction
- Graceful fallback with real computed values
"""
import google.generativeai as genai
import json, re
from app.core.config import settings
from loguru import logger


def _model():
    key = settings.GEMINI_API_KEY
    if not key or key in ("YOUR_GEMINI_API_KEY_HERE", ""):
        return None
    genai.configure(api_key=key)
    return genai.GenerativeModel("gemini-1.5-flash")


SYSTEM_PROMPT = """You are a market diagnosis assistant for the Market Diagnosis Platform (MDP).
MDP analyzes the Indian stock market (NSE & BSE) using End-of-Day data and structural indicators.

STRICT RULES:
- NEVER give buy/sell recommendations or price targets
- NEVER predict future prices or returns
- ONLY explain market structure, health scores, technical indicators, and historical context
- Always note this is a research/educational diagnostic tool
- Keep answers focused and under 250 words unless asked for detail
- Use plain English — avoid jargon unless the user seems technical
"""


class AIService:

    # ── Module 9+10: Daily Report Generation ──────────────────
    def generate_report(self, score_data: dict, exchange_data: dict) -> dict:
        model = _model()
        if not model:
            return self._fallback_report(score_data)

        flags_text = "\n".join(score_data.get("risk_flags", [])) or "None"

        prompt = f"""Generate a professional daily market diagnostic report for the Indian stock market.

=== TODAY'S DATA ===
Date: Today (Indian markets)
Overall Health Score: {score_data['overall_score']}/100
Market Regime: {score_data['regime']}
Trend Signal: {score_data.get('trend_signal', 'N/A')}
Stress Level: {score_data['stress_level']}/10

=== 5-PILLAR SCORES ===
Volatility (30%):     {score_data['volatility_score']}/100  [India VIX based]
Participation (25%):  {score_data['participation_score']}/100  [A/D breadth]
Stability (20%):      {score_data['stability_score']}/100  [Intraday range]
Exchange Sync (15%):  {score_data['exchange_sync_score']}/100  [NSE-BSE alignment]
Momentum (10%):       {score_data.get('momentum_score', 50)}/100  [RSI+MACD+SMA]

=== TECHNICAL INDICATORS ===
NSE RSI-14: {score_data.get('nse_rsi', 50):.1f}
MACD Histogram: {score_data.get('nse_macd_hist', 0):.3f}
Price vs SMA-20: {score_data.get('price_vs_sma20', 0):+.2f}%
Price vs SMA-50: {score_data.get('price_vs_sma50', 0):+.2f}%

=== EXCHANGE DATA ===
NSE (Nifty) Return: {exchange_data['nse_return']:+.2f}%
BSE (Sensex) Return: {exchange_data['bse_return']:+.2f}%
Stronger Exchange: {exchange_data['stronger_exchange']}
Bank Nifty: {exchange_data.get('bank_nifty_return', 0):+.2f}%

=== ACTIVE RISK FLAGS ===
{flags_text}

Write a 3-paragraph diagnostic report:
Paragraph 1: Overall structural condition (use the score and regime)
Paragraph 2: Technical picture (RSI, MACD, SMA position, Bank Nifty)
Paragraph 3: Exchange comparison and what today's breadth means

End EXACTLY with this line:
⚠️ Structural diagnosis only. Not investment advice. Not a price prediction."""

        try:
            resp = model.generate_content(prompt)
            narrative = resp.text.strip()

            # Extract key findings as JSON
            findings_prompt = f"""Based on this market data:
- Health Score: {score_data['overall_score']}/100, Regime: {score_data['regime']}
- Trend: {score_data.get('trend_signal')}, Stress: {score_data['stress_level']}/10
- RSI: {score_data.get('nse_rsi', 50):.1f}, MACD hist: {score_data.get('nse_macd_hist', 0):.3f}

Return ONLY a valid JSON array of exactly 5 short strings (key structural findings, no investment advice).
Example format: ["Finding one", "Finding two", "Finding three", "Finding four", "Finding five"]"""

            findings_resp = model.generate_content(findings_prompt)
            match = re.search(r'\[.*?\]', findings_resp.text, re.DOTALL)
            findings = json.loads(match.group()) if match else []

            return {
                "narrative": narrative,
                "key_findings": findings[:5],
                "regime_summary": f"{score_data['regime']} regime · Score {score_data['overall_score']}/100 · Trend {score_data.get('trend_signal', 'N/A')}",
                "risk_flags": score_data.get("risk_flags", []),
                "generated_by": "gemini-1.5-flash",
            }

        except Exception as e:
            logger.error(f"Gemini report error: {e}")
            return self._fallback_report(score_data)

    # ── AI Chat ────────────────────────────────────────────────
    def chat(self, user_message: str, context: dict = None,
             history: list = None) -> str:
        model = _model()
        if not model:
            return ("AI assistant is offline. Add your GEMINI_API_KEY to the .env file "
                    "and restart the backend. The rest of the platform works without it.")

        ctx = ""
        if context:
            ctx = f"""
Current market context (as of today):
- Health Score: {context.get('score', 'N/A')}/100
- Regime: {context.get('regime', 'N/A')}
- Trend: {context.get('trend', 'N/A')}
- India VIX: {context.get('vix', 'N/A')}
- RSI: {context.get('rsi', 'N/A')}
- Stress Level: {context.get('stress', 'N/A')}/10
"""

        full_prompt = f"{SYSTEM_PROMPT}\n{ctx}\nUser: {user_message}"

        try:
            resp = model.generate_content(full_prompt)
            return resp.text.strip()
        except Exception as e:
            logger.error(f"Gemini chat error: {e}")
            return "Unable to process your question right now. Please try again in a moment."

    # ── Fallback (no API key) ──────────────────────────────────
    def _fallback_report(self, score_data: dict) -> dict:
        s = score_data.get("overall_score", 50)
        regime = score_data.get("regime", "Unknown")
        trend  = score_data.get("trend_signal", "N/A")
        stress = score_data.get("stress_level", 0)
        rsi    = score_data.get("nse_rsi", 50)
        flags  = score_data.get("risk_flags", [])

        narrative = (
            f"Today's market health score is {s}/100, placing the market in the {regime} regime "
            f"with a {trend} trend signal and stress level of {stress}/10. "
            f"The RSI stands at {rsi:.1f}, "
            f"{'indicating overbought conditions.' if rsi > 70 else 'indicating oversold conditions.' if rsi < 30 else 'in neutral territory.'} "
            f"The five-pillar diagnostic framework covers volatility, participation, stability, "
            f"exchange synchronisation, and momentum to provide a holistic structural view.\n\n"
            f"Add your GEMINI_API_KEY to the .env file to enable AI-generated narrative reports "
            f"with richer contextual analysis from Google Gemini.\n\n"
            f"⚠️ Structural diagnosis only. Not investment advice. Not a price prediction."
        )
        findings = [
            f"Market Health Score: {s}/100",
            f"Regime: {regime} · Trend: {trend}",
            f"Stress Level: {stress}/10",
            f"RSI-14: {rsi:.1f} — {'overbought' if rsi>70 else 'oversold' if rsi<30 else 'neutral'}",
            "Configure GEMINI_API_KEY for AI-powered narrative reports",
        ]
        return {
            "narrative": narrative,
            "key_findings": findings,
            "regime_summary": f"{regime} regime · {trend} trend · Score {s}/100",
            "risk_flags": flags,
            "generated_by": "fallback",
        }


ai_service = AIService()
