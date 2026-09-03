"""
WhatsApp Business API

Purpose : The only file that talks to WhatsApp. Sends a message and reports success or failure. Credentials come from config.py.
Spec    : Section 3.1 and 15.3
Look here when : A WhatsApp message is not delivered.
"""

import logging

import httpx

from ..config import settings

log = logging.getLogger(__name__)

TIMEOUT_SECONDS = 15


class ChannelUnavailable(Exception):
    """
    Raised so the caller can queue the message rather than fail the whole order.
    Spec 15.4: if WhatsApp is unavailable the order is still created and the
    message retries -- the user is told the order was placed and the message is
    pending, not that everything failed.
    """


def is_configured() -> bool:
    return bool(settings.whatsapp_access_token and settings.whatsapp_phone_number_id)


def send(to_number: str, message: str) -> str:
    """
    Returns the provider message id.

    Open question Q11: Business API access needs a verification that can take
    weeks. Until it is approved this logs and returns a stub id, so the whole
    ordering flow can be built and demonstrated without waiting -- and the only
    file that changes when approval arrives is this one.
    """
    if not is_configured():
        log.info("whatsapp not configured, would have sent %d chars to %s",
                 len(message), to_number)
        return "stub-whatsapp-message-id"

    url = f"{settings.whatsapp_api_url}/{settings.whatsapp_phone_number_id}/messages"
    try:
        response = httpx.post(
            url,
            headers={"Authorization": f"Bearer {settings.whatsapp_access_token}"},
            json={
                "messaging_product": "whatsapp",
                "to": to_number,
                "type": "text",
                "text": {"body": message},
            },
            timeout=TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()["messages"][0]["id"]
    except Exception as exc:
        log.warning("whatsapp send failed for %s: %s", to_number, exc)
        raise ChannelUnavailable(str(exc)) from exc
