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


def test_provider_status_keeps_eod_and_enrichment_separate_from_disabled_live():
    status = MarketDataService().source_status()

    assert status["primary_eod"]["provider"] == "TejHQ / Tej Bazaar"
    assert status["eod_enrichment"]["provider"] == "BharatStock"
    assert status["live"]["provider"] == "Not configured"
    assert status["live"]["status"] == "disabled"
    assert status["live"]["configured"] is False
    assert status["live"]["is_live"] is False
    assert status["index_diagnosis"]["status"] == "fallback"
