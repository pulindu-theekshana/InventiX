"""
Order labelling

Purpose : The short "what is in this order" line that sits next to a reference. Written once because both feeds show it: a reference alone tells nobody what the order was for.
Spec    : Section 8.1 and 10.2
Look here when : An order reads differently on the customer side than on the supplier side.
"""


def product_summary(items: list[dict]) -> str | None:
    """
    The first product, plus how many others, from an order_items rows list.

    Returned rather than assembled in each app, because the customer and supplier
    screens both show it and two copies of this would drift the moment one of them
    started truncating differently.

    None for an order with no lines, so the app renders the reference alone rather
    than a stray separator.
    """
    names = [
        i["product_catalog"]["name"]
        for i in items
        if i.get("product_catalog") and i["product_catalog"].get("name")
    ]
    if not names:
        return None
    if len(names) == 1:
        return names[0]
    return f"{names[0]} +{len(names) - 1} more"
