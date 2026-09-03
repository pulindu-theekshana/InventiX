"""
Learned supplier recommendation

Purpose : Suggests a supplier from past outcomes rather than the fixed formula in ranking.py.
Spec    : Section 7.2
Look here when : Recommendations disagree badly with the formula.
"""

# Spec 7.2, and worth being clear about what this is not.
#
# domain/ranking.py already ranks suppliers, and spec 12 is explicit that it does
# NOT use machine learning: it is a weighted score with tunable weights. That is
# the version in use, and it is the one the app renders.
#
# This file is the later enhancement: learning from actual outcomes -- which
# suppliers were rejected, which delivered late against their own estimate, which
# were reordered from -- rather than assuming the four weights are right.
#
# The important property is that it must be comparable to the formula. When this
# lands, a recommendation that disagrees sharply with domain/ranking.py is a
# signal to check the model, not to trust it -- which is what this file's
# bug-map line is about.


def is_available() -> bool:
    return False


def recommend(customer_id: str, catalog_product_id: str, quantity: int) -> list[str]:
    """
    Returns supplier ids best first, or empty to fall back to domain/ranking.py.
    Empty rather than raising, so the Suppliers feed keeps working unchanged.
    """
    return []
