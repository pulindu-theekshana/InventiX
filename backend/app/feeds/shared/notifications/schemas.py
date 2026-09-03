"""
Notification models

Purpose : Notification list item and device registration shapes.
Spec    : Section 5.12
Look here when : Tapping a notification opens the wrong screen.
"""

from typing import Literal

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    body: str
    # Both nullable, and both are what let a tap open the right screen. The app
    # routes on them in hooks/useNotifications.ts, and push will use the same rule.
    related_order_id: str | None = None
    related_stock_item_id: str | None = None
    read_at: str | None = None
    created_at: str


class DeviceTokenIn(BaseModel):
    fcm_token: str
    # Spec 5.12: Firebase has to know which platform a token belongs to.
    platform: Literal["ios", "android"]
