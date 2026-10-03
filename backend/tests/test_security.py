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


# ---------------------------------------------------------------------------
# Cashier accounts (migration 0029)
# ---------------------------------------------------------------------------
def _user(role: str, employer: str | None = None):
    from app import dependencies

    return dependencies.CurrentUser(
        id="u-1",
        role=role,
        business_name="Wasantha Kade",
        contact_person="Nimal",
        email="nimal.3f8a1c@till.inventix.app",
        access_token="t",
        shop_id=employer or "u-1",
    )


def test_till_accepts_owner_and_cashier():
    from app import dependencies

    assert dependencies.require_till(_user("customer")).shop_id == "u-1"
    assert dependencies.require_till(_user("cashier", "shop-9")).shop_id == "shop-9"


def test_cashier_refused_everywhere_else():
    """The point of the role: the owner's feeds are not reachable with a staff login."""
    from app import dependencies
    from app.core.exceptions import Forbidden

    for guard in (dependencies.require_customer, dependencies.require_supplier):
        with pytest.raises(Forbidden):
            guard(_user("cashier", "shop-9"))


def test_supplier_refused_at_the_till():
    from app import dependencies
    from app.core.exceptions import Forbidden

    with pytest.raises(Forbidden):
        dependencies.require_till(_user("supplier"))


def test_login_email_is_typeable_and_unique():
    from app.feeds.customer.pos import service

    first = service._login_email("Nimal Perera")
    second = service._login_email("Nimal Perera")
    assert first.startswith("nimalperera.") and first.endswith("@till.inventix.app")
    assert first != second, "two people with one name would collide on sign-in"
    # A name with nothing usable in it still has to produce an address.
    assert service._login_email("???").startswith("cashier.")
