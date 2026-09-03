# Open questions

Decisions not yet made. Each has a suggested default so no work is blocked.
When one is answered, move it to `04-decision-log.md` as a numbered decision and delete it here.

## From the functional specification §17

| # | Question | Suggested default | Needed by |
|---|---|---|---|
| Q1 | Who populates the shared product catalog, and what happens when a product is missing? | Seed common Sri Lankan grocery products; users submit a request creating a pending entry rather than typing free text. | Phase 1 — blocks the catalog seed |
| Q2 | How long before an unanswered order triggers a notification? | 24 hours, stored in `app_config`. | Phase 7 |
| Q3 | How long before an unconfirmed delivery is auto-confirmed? | Three days, with a warning one day before. | Phase 7 |
| Q4 | Are the ranking weights 40/30/20/10 correct? | Start with them, store in `app_config`, tune after testing. | Phase 6 |
| Q5 | Can a customer order from a supplier not registered on InventiX? | Yes, by WhatsApp or email, with the customer advancing stages manually. | Phase 4 |
| Q6 | Is the rating prompt mandatory or skippable? | Skippable but shown twice. | Phase 6 |
| Q7 | Should suppliers see which other suppliers a customer uses? | No. §15.1 already assumes they cannot. | Phase 1 — affects RLS policies |

## Raised while designing the file structure

| # | Question | Suggested default | Needed by |
|---|---|---|---|
| Q8 | The pie chart in Figma has four segments; the specification defines three. Which is right? | Follow the specification. "Overstock" has no `high_threshold` field to compute it from, and "Restock requested" tells the owner something actionable. See `07-design-vs-spec.md`. | Before Phase 2 |
| Q9 | Who owns which folder? Four people editing `domain/` at once will conflict. | Assign one member per area: database and auth, stocks and uploads, ordering and delivery, suppliers and reports. | Immediately |
| Q10 | Where is the backend deployed, and does the app point at a local IP during development? | Environment variable in the app, defaulting to the developer's machine on the local network. | Phase 1 |
| Q11 | WhatsApp Business API access requires a business verification that can take weeks. Has it been started? | Start the application now; build against a stub `integrations/whatsapp.py` until it is approved. | Before Phase 4 |
