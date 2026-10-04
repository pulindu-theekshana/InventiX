# Future developments

Briefings for work that is designed but not built. One file per piece of work.

These are not a wish list and not a backlog. Each file is written so that whoever picks the work up
can start from it alone: what the thing is, what it needs before it can exist, what it gives the
person using the app, what it takes away from them when it is wrong, and the traps already found by
thinking it through or by building part of it.

The test for whether a file belongs here: **could somebody build this from the file without asking
the person who wrote it any questions?** If not, it is not finished.

| File | What it covers | Blocked on |
|---|---|---|
| `machine-learning.md` | All four models in specification §7.2 — demand forecast, learned thresholds, learned festival uplift, supplier recommendation from outcomes. One is built; the file covers the rest. | Sales history. Three months for two of them, a year for one, a working rating endpoint for the last. |

## Why this is a separate folder

The rest of `docs/` describes what the application **is**. These files describe what it is **not
yet**, and mixing the two makes both harder to trust — a reader cannot tell whether a paragraph is
describing behaviour they can rely on or behaviour somebody intended.

When a piece of work here gets built, its file does not move. The decision log gets an entry, the
changelog gets an entry, and the file here is rewritten to describe what is left. A file with
nothing left in it is deleted, because by then `04-decision-log.md` holds the reasoning and the code
holds the rest.
