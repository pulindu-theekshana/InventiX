"""
Reports logic

Purpose : The non-ML reports built first: stock movement, best and worst sellers, spend by supplier, delivery times per supplier, stock-out counts. Also reads stored ML predictions, never computes them live.
Spec    : Section 7.1
Look here when : A report number looks wrong or a report is slow.
"""

from .schemas import ReportSectionOut

# Spec 7.1: the five reports that need no machine learning. Each becomes a plain
# query once sales_records and orders carry data. The four models in 7.2 come
# after that, computed on a schedule and stored -- never on screen open.
SECTIONS: list[dict] = [
    {
        "key": "stock-movement",
        "title": "Stock movement",
        "description": "How one product has risen and fallen over a chosen period.",
        "icon": "trending-up-outline",
        "requires": "At least one applied sales report, so there is movement to plot.",
    },
    {
        "key": "best-worst",
        "title": "Best and worst sellers",
        "description": "Which products move fastest, and which sit on the shelf.",
        "icon": "podium-outline",
        "requires": "A few weeks of sales records, so fast and slow are meaningful.",
    },
    {
        "key": "spend-by-supplier",
        "title": "Spend by supplier",
        "description": "What you have spent with each supplier over a period.",
        "icon": "wallet-outline",
        "requires": "At least one completed order.",
    },
    {
        "key": "delivery-times",
        "title": "Order history and delivery times",
        "description": "Every order, and how long each supplier actually took.",
        "icon": "time-outline",
        "requires": "At least one order that reached Completed, which is what times a delivery.",
    },
    {
        "key": "stock-outs",
        "title": "Stock-out events",
        "description": "How often a product reached zero, and which ones.",
        "icon": "alert-circle-outline",
        "requires": "Sales history, so we can see when a product reached zero.",
    },
]


def list_sections(db, customer_id: str) -> list[ReportSectionOut]:
    """
    Returns the sections, each marked with whether this shop has the data for it
    yet. Two cheap counts rather than five queries: every section depends on
    either sales history or completed orders.
    """
    has_sales = bool(
        db.table("sales_uploads").select("id")
        .eq("customer_id", customer_id).eq("status", "applied").limit(1).execute().data
    )
    has_orders = bool(
        db.table("orders").select("id")
        .eq("customer_id", customer_id).eq("status", "purchased").limit(1).execute().data
    )

    needs_orders = {"spend-by-supplier", "delivery-times"}
    return [
        ReportSectionOut(
            **section,
            available=has_orders if section["key"] in needs_orders else has_sales,
        )
        for section in SECTIONS
    ]
