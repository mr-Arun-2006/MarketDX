from datetime import timedelta

from app.core.security import create_access_token, decode_token, hash_password, verify_password


def test_password_hash_and_verify():
    password = "TestPassword123!"
    hashed = hash_password(password)

    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("wrong-password", hashed)


def test_access_token_round_trip():
    token = create_access_token({"sub": "test-user"}, timedelta(minutes=5))
    payload = decode_token(token)

    assert payload is not None
    assert payload["sub"] == "test-user"
    assert payload["type"] == "access"


def test_invalid_token_is_rejected():
    assert decode_token("not-a-valid-jwt") is None
