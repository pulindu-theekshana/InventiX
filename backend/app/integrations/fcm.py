"""
Firebase Cloud Messaging

Purpose : The only file that talks to FCM. Handles android and ios tokens and removes stale ones.
Spec    : Section 5.12 and 13
Look here when : Push notifications do not arrive on a device.
"""

import logging

from ..config import settings

log = logging.getLogger(__name__)

_app = None


def _client():
    """
    Imported lazily so the backend runs without Firebase configured. Push is
    phase 7; everything before it should not fail to start for want of a
    credentials file.
    """
    global _app
    if not settings.firebase_credentials_path:
        return None
    if _app is None:
        import firebase_admin
        from firebase_admin import credentials

        cred = credentials.Certificate(settings.firebase_credentials_path)
        _app = firebase_admin.initialize_app(cred)
    return _app


def send(tokens: list[str], title: str, body: str, data: dict | None = None) -> list[str]:
    """
    Sends to every device the user has. Returns the tokens that failed, so the
    caller can expire them -- a dead token otherwise fails silently forever.

    A failure here is logged and swallowed. Spec 13 writes the notification row
    first, so the user still sees it in the app even when the push does not
    arrive; losing the row because Firebase is down would be the worse outcome.
    """
    if not tokens:
        return []
    if _client() is None:
        log.info("push not configured, would have sent %r to %d device(s)", title, len(tokens))
        return []

    from firebase_admin import messaging

    failed: list[str] = []
    try:
        response = messaging.send_each_for_multicast(
            messaging.MulticastMessage(
                tokens=tokens,
                notification=messaging.Notification(title=title, body=body),
                data={k: str(v) for k, v in (data or {}).items()},
            )
        )
        for token, result in zip(tokens, response.responses, strict=True):
            if not result.success:
                failed.append(token)
    except Exception:
        log.exception("push send failed for %d token(s)", len(tokens))
        return []

    return failed
