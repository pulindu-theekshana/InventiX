# InventiX — product overview

Everything the product does, for anyone writing about it: website copy, a pitch deck, the
project report. Written in plain language rather than developer language.

Last updated 15 September 2026.

---

## The one-line version

**InventiX tells a grocery shop what is running out before the shelf is empty, and puts the
order in the supplier's hands in three taps.**

## The problem

A small grocery shop in Sri Lanka runs on memory. The owner knows roughly what sells, notices
roughly when something runs low, and phones a supplier when they remember. What that costs
them:

- **Empty shelves.** A product runs out on Friday and nobody notices until a customer asks for
  it on Sunday. That is two days of lost sales on an item people wanted.
- **Money asleep on a shelf.** Ordering "enough to be safe" ties up cash in stock that turns
  slowly, while the fast movers run out.
- **No memory of suppliers.** Who actually delivers on time? Who was cheapest last month? Who
  promised two days and took six? It lives in the owner's head, or nowhere.
- **Festivals arrive unprepared.** Everyone knows Christmas and Deepavali lift sales. Far fewer
  know which of *their* products lift, and by how much, in time to order.
- **The POS already knows.** Many shops have a till that records every sale — and that data is
  never used for anything.

## Who it is for

**Two roles, one app.** You pick which you are when you register.

| Role | Who they are | What they get |
|---|---|---|
| **Shop** (customer) | The owner of a small or medium grocery shop | Knows what is low, who to buy from, and where every order is |
| **Supplier** | A distributor or wholesaler selling to those shops | Orders arrive in the app, and good service is visible to new customers |

Suppliers matter because they make delivery tracking honest. Somebody has to actually press
"on the way" — a shop guessing at a delivery status is just a shop guessing.

---

# What the app does today

Everything in this section is built and working.

## For the shop

### The stock dashboard
Opens on what needs attention. A pie chart splits everything three ways — **in stock**, **low
stock**, **restock requested** — and the list below is grouped the same way, with the urgent
section first. The three-way split is computed in exactly one place in the system, so the chart
and the list can never disagree with each other.

Every product shows what is on hand, the level you want to be warned at, its price, and which
supplier you usually buy it from.

### A low-stock level per product
Ten bags of rice might be a crisis; two hundred packets of tea might be normal. The warning
level is set per product, and the app suggests a sensible starting point (about a quarter of
what you hold) so nobody has to think hard about every item.

### Restock in three taps
Tap a low item, and the app writes the order message for you: your shop's name, the products,
the quantities, the estimated total, in polite complete sentences. You can edit it, change who
it goes to, set a delivery date, add a note, and send — **in the app, by WhatsApp, or by
email**, whichever that supplier actually uses.

Quantities are checked against what the supplier genuinely has: ask for more than they hold, or
less than their minimum order, and the app says so before you send rather than after.

### Sending is safe to retry
A tap on a bad connection is a real risk: did it send or not? Every order carries a one-time
key, so pressing Send twice creates **one** order, never two.

### It refuses to order the same thing twice
If a product is already on an open order with that supplier, the app stops and asks. Two
deliveries of the same rice both arrive, and the stock count goes up twice. From a *different*
supplier it only warns — chasing a slow supplier with a second order is a legitimate decision,
and the app treats the owner as an adult.

### Supplier search, ranked
Search by company name, or by product — "who sells Highland Milk Powder, and how good are
they?" Results come back ranked, with the ones who cannot fill your quantity marked rather
than hidden, so you can see why they placed lower.

### Delivery tracking
Six stages, visible to both sides: **requested → confirmed → processing → put to delivery →
on the way → purchased.** The shop sees progress without phoning anyone. Stage changes arrive
live, without refreshing.

Only the shop can mark an order complete, because that is the moment stock goes up. A supplier
saying "delivered" is a claim; the shop confirming is the fact.

### Stock goes up by itself
Confirm receipt and every product on that order is added to your count automatically, with a
record of why it changed.

### Upload your POS sales report
Export the day's or week's sales from your till as CSV or Excel, upload it, and the app reduces
your stock by what you sold. It works this way deliberately: **it needs no special connection
to any particular POS system** — if the till can export a file, InventiX can read it.

- It finds the columns itself and lets you correct it
- Product names that do not match your catalog are matched once, by you, and remembered for
  every future upload — a till saying "SUGAR 1KG WHT" is understood from then on
- The same file cannot be applied twice, so stock is never reduced twice

### Festival warnings
Sri Lankan festivals are on the calendar — Christmas, Deepavali, Sinhala and Tamil New Year,
Vesak, Ramadan. Weeks ahead, the app flags the products in categories that usually lift, with
a suggested quantity, and lets you order straight from the warning.

### Every quantity change is explained
Manual corrections, damage, spoilage, a miscount, a delivery, a sales upload — each writes a
dated record. A number that looks wrong can always be traced to what changed it and when. The
audit record and the quantity change are written together, so one can never exist without the
other.

### Notifications
Low stock, order accepted or declined, each delivery stage, delivery arrived, a supplier who
has not replied, festival reminders, and a nudge when your stock figures are going stale. The
unread count updates live, and tapping one opens the thing it is about.

### Reports
Five reports that need no machine learning, just your own history: stock movement over time,
best and worst sellers, spend by supplier, order history with actual delivery times, and
stock-out events.

## For the supplier

### A home dashboard
Opens on their own summary: business name, city, how many products they list, their **average
rating**, orders **awaiting a reply**, completed orders, and their **best customers by value**.

### Listings
What they sell, with price, available quantity, minimum order and lead time. This is what shops
search — a supplier with no listings is invisible. Listings are switched off rather than
deleted, so past orders keep making sense.

### Orders
Incoming requests in three groups — pending, active, history. Confirm or decline, and a decline
requires a reason, which the shop sees. Move orders through the delivery stages, and mark them
delivered.

### Being rated fairly
A supplier's standing is built from what they did, not what they promised. Delivery speed is
**measured from orders that actually completed**. A supplier cannot improve it by claiming a
shorter lead time.

## The supplier ranking

A score out of 100, recomputed continuously and stored so searching is instant:

| Part | Weight | Where it comes from |
|---|---|---|
| Quality | 40% | Star ratings from shops after delivery |
| Delivery speed | 30% | Measured from completed orders, never the claimed lead time |
| Quantity availability | 20% | Whether they can fill what you actually asked for |
| Price | 10% | Against other suppliers of the same product |

Two details that make it fair:

- **Confidence weighting.** With one or two ratings the average is pulled toward neutral. Two
  opinions are not evidence, and one five-star review should not put a supplier at the top.
- **New suppliers are labelled, not buried.** Under three completed orders they are shown as
  new with a provisional score, so a newcomer is visible rather than invisible.

## Things that protect the shop's data

- **One shared product catalog.** Everyone picks from the same list; nobody types product
  names. If a shop typed "Rice 5kg" and a supplier typed "5kg rice bag", nothing could ever be
  matched — supplier search, ranking and POS matching would all fail at once.
- **Every shop sees only its own data,** enforced by the database itself, not just the app.
- **Business rules live on the server.** The app can ask; it cannot decide. Quantities,
  permissions and order stages are all re-checked centrally.
- **A rejected order gives a reason**, always. No silent refusals.
- **If WhatsApp is down, the order still exists** and the message is queued.

---

# What is coming next

Built on purpose to need real sales history first — a model trained on a week of data is a
guess wearing a lab coat.

### Demand forecasting
Predicts units sold per product over the coming weeks from the shop's own sales history, so
"low stock" becomes "you will run out on Thursday". Needs several weeks of uploads before it
says anything at all, and says so rather than inventing a number.

### Learned festival uplift
Today every shop sees the same expected festival lift. Next, each shop's *own* history decides:
your Christmas biscuit lift, from your sales, not the national average.

### Smarter low-stock levels
The warning level suggested from real sales velocity and that supplier's measured lead time —
a fast-moving product from a slow supplier should be flagged far earlier than a slow-moving one
from a fast supplier.

### Supplier recommendations from outcomes
Beyond the fixed formula: which supplier has actually served *this* shop best for *this*
product, learned from what happened rather than weighted averages.

### Push notifications
Alerts on the phone's lock screen when the app is closed. In-app notifications work today.

### Also planned
- An installable Android app, with the icon in the phone's menu
- Hosted backend, so the app works on any network
- A profile and password screen for both roles
- Editing a saved POS product match after the fact

---

# How it is built

Useful for a technical audience, and for the project report.

| Part | Technology |
|---|---|
| Mobile app | React Native with Expo, TypeScript, file-based routing |
| Backend | Python with FastAPI |
| Database | Supabase (PostgreSQL) with row level security |
| Live updates | Supabase realtime |
| Messaging | WhatsApp Business API, email |

**Architecture principle:** the app may *read* directly from the database, because the database
enforces who can see what. Anything with a consequence — a quantity change, an order, a status
— goes through the backend, because that is where the rules and the secrets live.

**Correctness by construction:** things that must happen together do happen together. An order,
its lines and its stock flags are written in one transaction. A quantity change and its audit
record cannot be separated. This is enforced inside the database, not hoped for in application
code.

Roughly 95 automated tests cover the rules that matter: the three-way stock classification,
every legal and illegal order transition, the ranking formula, the POS file reader against
real-world messiness, and token verification.

---

# Words worth using on the website

Phrases that are true, specific, and not marketing noise:

- "Know what is running out before the shelf is empty."
- "Your till already knows what you sold. InventiX puts it to work."
- "Three taps from low stock to an order in your supplier's hands."
- "Suppliers ranked by what they did, not what they promised."
- "Works with any POS that can export a file. No integration required."
- "Every number can be traced to what changed it."
- "Built for Sri Lankan grocery shops — festivals, suppliers and products included."

**Avoid claiming:** live POS integration (it reads exported files), AI-powered forecasting
(that is the next phase, not today), and anything about scale or customer numbers that has not
happened yet.
