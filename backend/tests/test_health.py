import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    # Reuse one lifespan/event loop for both endpoint tests. The app's async
    # SQLAlchemy engine is process-scoped and should not be rebound to a new loop
    # between separate TestClient contexts.
    with TestClient(app) as test_client:
        yield test_client


def test_health_endpoint(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["platform"] == "MDP v1.0"


def test_root_endpoint(client):
    response = client.get("/")

    assert response.status_code == 200
    body = response.json()
    assert body["message"] == "Market Diagnosis Platform API"
    assert body["docs"] == "/api/docs"
