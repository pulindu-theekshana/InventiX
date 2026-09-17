"""
Notification endpoints

Purpose : The in-app notification list and device registration.
Spec    : Section 13
Look here when : The in-app notification list fails to load.
"""

from fastapi import APIRouter, status

from ....dependencies import CurrentUserDep
from . import service
from .schemas import DeviceTokenIn, NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def list_notifications(user: CurrentUserDep) -> list[NotificationOut]:
    return service.list_for_user(user.db, user.id)


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(notification_id: str, user: CurrentUserDep) -> None:
    service.mark_read(user.db, user.id, notification_id)


@router.post("/device", status_code=status.HTTP_204_NO_CONTENT)
def register_device(body: DeviceTokenIn, user: CurrentUserDep) -> None:
    service.register_device(user.db, user.id, body.fcm_token, body.platform)
