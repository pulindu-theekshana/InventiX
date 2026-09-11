"""
Token verification tests

Purpose : Proves both Supabase signing schemes are accepted and that a token cannot choose its own key type. Run after touching core/security.py.
Spec    : Section 15.2
Look here when : After touching core/security.py.
"""

import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from app.core import security
from app.core.exceptions import Unauthorized

SECRET = "test-hs256-secret-at-least-32-bytes-long"
KEY = ec.generate_private_key(ec.SECP256R1())


def _token(key, alg, **overrides):
    claims = {"sub": "user-1", "email": "a@b.lk", "aud": "authenticated",
              "exp": int(time.time()) + 60, **overrides}
    return jwt.encode(claims, key, algorithm=alg)


@pytest.fixture(autouse=True)
def keys(monkeypatch):
    monkeypatch.setattr(security.settings, "supabase_jwt_secret", SECRET)
    jwks = type("J", (), {"get_signing_key_from_jwt": lambda self, t: type("K", (), {"key": KEY.public_key()})()})()
    monkeypatch.setattr(security, "_jwks_client", lambda: jwks)


def test_es256_token_accepted():
    assert security.verify_access_token(_token(KEY, "ES256")).user_id == "user-1"


def test_hs256_token_accepted():
    assert security.verify_access_token(_token(SECRET, "HS256")).user_id == "user-1"


def test_expired_token_refused():
    with pytest.raises(Unauthorized, match="expired"):
        security.verify_access_token(_token(KEY, "ES256", exp=int(time.time()) - 60))


def test_wrong_key_refused():
    other = ec.generate_private_key(ec.SECP256R1())
    with pytest.raises(Unauthorized):
        security.verify_access_token(_token(other, "ES256"))


def test_unsigned_token_refused():
    with pytest.raises(Unauthorized):
        security.verify_access_token(_token(None, "none"))
