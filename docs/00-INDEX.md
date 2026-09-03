# Documentation index

| Document | What it is | When you must update it |
|---|---|---|
| `01-architecture.md` | How frontend, backend and database relate, and the rules that must not be broken. | You add a new kind of component, or change how the layers talk. |
| `02-file-structure.md` | The complete file tree with the reasoning behind each grouping. | You add a folder, or move where a kind of code lives. |
| `03-bug-map.md` | Symptom to file, and spec section to file. | You add a file that owns a rule, or move a rule between files. |
| `04-decision-log.md` | Every decision about how the app works, dated, with reasoning. | **Whenever you change your mind about how the app works.** Append, never rewrite. |
| `05-changelog.md` | What was built, changed or removed. | Whenever you finish a piece of work. |
| `06-open-questions.md` | Decisions not yet made, each with a suggested default. | A question is answered (move it to the decision log) or a new one appears. |
| `07-design-vs-spec.md` | Where the Figma file and the specification disagree, and what is not designed. | A design is changed, or a missing screen is designed. |
| `08-api-contract.md` | Every endpoint the backend must provide, what it receives and returns, and the rule it enforces. Derived from the frontend, which was built first. | You add, remove or change the shape of an endpoint. |
| `09-database-build.md` | How the Supabase database is created, in what order, the row level security policies, and the queries the backend runs. | You add a migration, change a policy, or add an index. |
| `10-connections.md` | How the app, the backend and the database actually talk to each other: the three edges, the two keys, and a traced request through all of them. | You change how a layer reaches another, or move a read between the direct and backend paths. |

## The maintenance rule

There are two kinds of writing-down and they are not the same thing.

- **A decision** goes in `04-decision-log.md`. It records *what you decided and why*, and it is
  never deleted, even when a later decision reverses it — the reversal becomes a new entry that
  references the old one. This is the document that answers "why is it like this?" six weeks later,
  and it is the document your project report is written from.
- **A change** goes in `05-changelog.md`. It records *what now exists that did not before*.

If a decision changes how the app behaves, it almost always also changes the specification,
one or more files, and possibly `03-bug-map.md`. Update all of them in the same sitting.
A decision log that disagrees with the code is worse than no decision log.
