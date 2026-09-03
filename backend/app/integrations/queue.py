"""
Outbound retry queue

Purpose : Holds messages whose channel was unavailable and retries them, so an order is still created when WhatsApp is down.
Spec    : Section 15.4
Look here when : An order exists but its message was never sent.
"""

import logging

from . import email_sender, whatsapp
from .whatsapp import ChannelUnavailable

log = logging.getLogger(__name__)

MAX_ATTEMPTS = 5


def dispatch(channel: str, *, to_number: str | None = None, to_address: str | None = None,
             subject: str = "", message: str = "") -> tuple[bool, str]:
    """
    Sends on the chosen channel. Returns (sent, detail).

    Never raises. Spec 15.4 is explicit: if the channel is unavailable the order
    is still created and the message is queued, and the user is told the order was
    placed and the message is pending. Letting this propagate would fail the whole
    send because a third party was down.
    """
    try:
        if channel == "whatsapp":
            if not to_number:
                return False, "no WhatsApp number on file for this supplier"
            return True, whatsapp.send(to_number, message)
        if channel == "email":
            if not to_address:
                return False, "no email address on file for this supplier"
            return True, email_sender.send(to_address, subject or "Restock request", message)
        # in_app needs no outbound call: the order is already in the supplier's feed.
        return True, "in_app"
    except ChannelUnavailable as exc:
        log.warning("channel %s unavailable: %s", channel, exc)
        return False, str(exc)


def enqueue(order_id: str, channel: str, payload: dict) -> None:
    """
    ponytail: not implemented, and deliberately not a table yet. The retry store
    is one row per pending message -- order id, channel, payload, attempts,
    next_attempt_at -- plus a job in jobs/ that drains it.

    Until it exists, dispatch() reports the failure to the caller, which records
    it on the order and tells the user the message is pending. Nothing is lost;
    it simply is not retried automatically. Add the table when phase 4 sending is
    real, not before -- the shape depends on what the channels actually return.
    """
    log.warning(
        "message for order %s on %s could not be sent and is not queued yet: %s",
        order_id, channel, payload.get("reason", "unknown"),
    )
