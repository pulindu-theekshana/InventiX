"""
Notification logic

Purpose : Writes a notification row and delivers the push, so the two can never disagree. Also registers device tokens.
Spec    : Section 13
Look here when : A notification arrives on the phone but not in the list, or the reverse.
"""

from datetime import UTC, datetime

from ....core.exceptions import NotFound
from ....core.supabase import service_client
from ....integrations import fcm
from .schemas import NotificationOut

COLUMNS = ("id, user_id, type, title, body, related_order_id, "
           "related_stock_item_id, read_at, created_at")


def list_for_user(db, user_id: str) -> list[NotificationOut]:
    rows = (
        db.table("notifications")
        .select(COLUMNS)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(100)
        .execute()
        .data
        or []
    )
    return [NotificationOut(**row) for row in rows]


def mark_read(db, user_id: str, notification_id: str) -> None:
    result = (
        db.table("notifications")
        .update({"read_at": datetime.now(UTC).isoformat()})
        .eq("id", notification_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        # Not yours and not found are the same answer, so an id cannot be probed.
        raise NotFound("We could not find that notification.")


def register_device(db, user_id: str, token: str, platform: str) -> None:
    """
    Upsert on the token, not on the user: a phone handed to someone else must
    move to the new account rather than notify both.
    """
    db.table("device_tokens").upsert(
        {
            "user_id": user_id,
            "fcm_token": token,
            "platform": platform,
            "last_seen_at": datetime.now(UTC).isoformat(),
        },
        on_conflict="fcm_token",
    ).execute()


def notify(user_id: str, type_: str, title: str, body: str, *,
           order_id: str | None = None, stock_item_id: str | None = None) -> None:
    """
    The single way anything in this backend tells a user something.

    Spec 13 requires every notification to appear both on the device and in the
    in-app list. Writing the row and sending the push in one place is what stops
    those two drifting apart -- the bug where a push arrives with nothing in the
    list behind it, or the reverse.

    Called by jobs and services, never by a route.
    """
    db = service_client()
    db.table("notifications").insert({
        "user_id": user_id,
        "type": type_,
        "title": title,
        "body": body,
        "related_order_id": order_id,
        "related_stock_item_id": stock_item_id,
    }).execute()

    tokens = [
        row["fcm_token"]
        for row in (db.table("device_tokens").select("fcm_token")
                    .eq("user_id", user_id).execute().data or [])
    ]
    if tokens:
        # A failed push must not lose the notification: the row is already
        # written, so the user still sees it next time they open the app.
        fcm.send(tokens, title, body,
                 data={"order_id": order_id or "", "stock_item_id": stock_item_id or ""})
