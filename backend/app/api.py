"""
Master router

Purpose : The single place every feed router is imported and mounted onto a URL prefix. This is the map of the whole API. One import line and one include_router line per feed.
Spec    : Section 3
Look here when : An endpoint returns 404, or you want to see every route the backend exposes.
"""

from fastapi import APIRouter

from .feeds.customer.delivery import routes as customer_delivery
from .feeds.customer.ordering import routes as customer_ordering
from .feeds.customer.reports import routes as customer_reports
from .feeds.customer.stocks import routes as customer_stocks
from .feeds.customer.suppliers import routes as customer_suppliers
from .feeds.customer.uploads import routes as customer_uploads
from .feeds.shared.auth import routes as shared_auth
from .feeds.shared.catalog import routes as shared_catalog
from .feeds.shared.notifications import routes as shared_notifications
from .feeds.supplier.delivery import routes as supplier_delivery
from .feeds.supplier.listings import routes as supplier_listings
from .feeds.supplier.orders import routes as supplier_orders
from .feeds.supplier.overview import routes as supplier_overview

api_router = APIRouter()

# Shared: reachable by both roles.
api_router.include_router(shared_auth.router)
api_router.include_router(shared_catalog.router)
api_router.include_router(shared_notifications.router)

# Customer feeds, spec 6 to 9.
api_router.include_router(customer_stocks.router)
api_router.include_router(customer_suppliers.router)
api_router.include_router(customer_ordering.router)
api_router.include_router(customer_delivery.router)
api_router.include_router(customer_uploads.router)
api_router.include_router(customer_reports.router)

# Supplier feeds, spec 10.
api_router.include_router(supplier_overview.router)
api_router.include_router(supplier_listings.router)
api_router.include_router(supplier_orders.router)
api_router.include_router(supplier_delivery.router)
