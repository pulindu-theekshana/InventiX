# InventiX backend

FastAPI. Every business rule in the application lives here.

## Running it

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env           # then fill in the values
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

`--host 0.0.0.0` matters: a phone on the same network cannot reach `127.0.0.1`.
Interactive API documentation is at `http://localhost:8000/docs` once it is running.

## The layering rule

Every feed is a folder with three files, and each has one job:

| File | Job | Never does |
|---|---|---|
| `routes.py` | URLs, methods, status codes. Parse request, call service, return. | Business logic, database access |
| `service.py` | The actual work. Queries, orchestration, calls into `domain/`. | Anything HTTP-shaped |
| `schemas.py` | Pydantic models for input and output. | Logic |

A rule used by more than one feed does not belong in a feed. It goes in `domain/`.

## Things that may only happen in one place

| Action | Only file allowed to do it |
|---|---|
| Change a stock quantity | `domain/stock.py` |
| Change an order status | `domain/order_state_machine.py` |
| Talk to WhatsApp | `integrations/whatsapp.py` |
| Talk to email | `integrations/email_sender.py` |
| Talk to Firebase | `integrations/fcm.py` |
| Read a secret | `config.py` |
| Send a notification | `feeds/shared/notifications/service.py` |

If you find yourself about to break one of these, the fix is a call into the owning file, not a
second implementation. See `docs/01-architecture.md`.
