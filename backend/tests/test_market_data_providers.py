from app.services.market_data import MarketDataService


def test_tej_envelope_unwraps_rows():
    payload = {
        "data": [
            {"date": "2026-10-30", "close": 100.0},
            {"date": "2026-11-02", "close": 101.0},
        ],
        "meta": {"count": 2},
    }

    rows = MarketDataService._unwrap_rows(payload)

    assert len(rows) == 2
    assert rows[-1]["close"] == 101.0


def test_tej_unwrap_accepts_list_response():
    rows = [{"date": "2026-11-02", "close": 101.0}]

    assert MarketDataService._unwrap_rows(rows) == rows


def test_upstox_quote_is_normalized():
    quote = {
        "symbol": "NIFTY 50",
        "last_price": 24050.0,
        "net_change": 150.0,
        "ohlc": {
            "open": 23900.0,
            "high": 24100.0,
            "low": 23880.0,
            "close": 23900.0,
        },
        "volume": 120000,
    }

    normalized = MarketDataService.normalize_upstox_quote("NSE_INDEX|Nifty 50", quote)

    assert normalized["symbol"] == "NIFTY 50"
    assert normalized["last_price"] == 24050.0
    assert normalized["change"] == 150.0
    assert normalized["change_percent"] == round(150 / 23900 * 100, 2)
    assert normalized["volume"] == 120000


def test_timestamp_normalization_handles_milliseconds():
    normalized = MarketDataService._timestamp_to_iso(1793552400000)

    assert normalized is not None
    assert normalized.endswith("+00:00")


def test_provider_status_separates_eod_enrichment_and_live():
    status = MarketDataService().source_status()

    assert status["primary_eod"]["provider"] == "TejHQ / Tej Bazaar"
    assert status["eod_enrichment"]["provider"] == "BharatStock"
    assert status["live"]["provider"] == "Upstox Market Quote API"
    assert status["index_diagnosis"]["status"] == "fallback"
