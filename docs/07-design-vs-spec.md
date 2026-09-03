# Design versus specification

Figma file: `https://www.figma.com/design/NYIxsHFQTr9eqcisWkn0xg/InventiX`
Last compared: 2026-09-01, against Functional Specification v1.0.

**Read this before building any screen from the Figma file.** Where the two disagree, the
specification wins unless a decision in `04-decision-log.md` says otherwise.

## 1. Direct contradictions

| Thing | Figma shows | Specification says | Ruling |
|---|---|---|---|
| Stock pie chart | Four segments: In stock, Low stock, Out of stock, Overstock | Three segments: In stock, Low stock, Restock requested (§6.2) | **Follow the spec.** There is no `high_threshold` column, so "Overstock" cannot be computed. "Restock requested" is the segment that tells the owner *stop worrying, it is already ordered* — the same state as the Requested badge in §6.4 that prevents double ordering. |
| Stocks section tabs | Four tabs matching the chart | Two sections: In stock, Low stock (§6.1) | **Follow the spec.** |
| Customer delivery tabs | Pending / In Transit / Delivered | Requested / Confirmed (§8.1) | **Follow the spec.** "Requested" means *waiting for the supplier to accept*, which "Pending" does not convey, and "Confirmed" holds four stages that "In Transit" does not cover. |
| Restock popup third button | "Suggested best supplier" | "Change supplier" (§6.5) | **Follow the spec** for behaviour; the Figma wording may be kept if the team prefers it, since the button opens a ranked list either way. |

## 2. Screens the specification requires that are not yet designed

| Screen | Spec | Why it matters |
|---|---|---|
| Stock item detail | §6.3, §6.6 | The only place a threshold is edited, a manual adjustment is recorded, or adjustment history is read. |
| Upload sales report | §6.6 | Without it stock never decreases, so nothing ever becomes low and the app never triggers. |
| Column mapping | §6.6 | Step two of the upload. |
| Unmatched products | §6.6 | Step three of the upload. |
| Order detail (customer) | §8.2 | Where Confirm receipt lives. |
| Order detail (supplier) | §10.2 | Where Confirm and Reject live. |
| Supplier profile | §9.2 | Measured delivery time and listings. |
| Add and edit listing | §10.1 | A supplier cannot sell anything without it. |
| Rating prompt | §12.3 | Forty percent of the ranking score depends on ratings existing. |
| Notification list | §13 | |
| Catalog search and product request | §5.2 | |

## 3. What the designs got right that is easy to lose

- The bottom navigation matches both role feed lists exactly: Stocks, Reports, Delivery, Suppliers
  for customers; Stocks, Orders, Delivery for suppliers.
- The auto-generated purchase order screen (Figma `264:105`) matches §6.5 closely, including the
  Edit and Send buttons and the suggested-supplier idea.
- Supplier Active and Inactive states match the `is_active` column.

## Maintenance

Update this document whenever a design changes or a missing screen is designed. When a
contradiction is resolved by changing the specification rather than the design, record it as a
decision in `04-decision-log.md` and remove the row from section 1 here.
