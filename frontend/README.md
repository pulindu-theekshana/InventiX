# InventiX frontend

React Native with Expo and expo-router, in TypeScript.

## First-time setup

This folder contains the **source tree only** — no `package.json`, `app.json` or `tsconfig.json`,
because those are produced by Expo's own generator and it refuses to run into a non-empty folder.
So generate the project beside this one and move its configuration in:

```bash
cd F:\Projects\InventiX
npx create-expo-app@latest _tmp --template blank-typescript
move _tmp\package.json        Project\frontend\
move _tmp\app.json            Project\frontend\
move _tmp\tsconfig.json       Project\frontend\
move _tmp\.gitignore          Project\frontend\
rmdir /s /q _tmp
cd Project\frontend
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
npx expo install @supabase/supabase-js expo-document-picker expo-notifications
npm install
npx expo start
```

Then set the entry point in `package.json` to `"main": "expo-router/entry"`, and add the
expo-router plugin to `app.json`. The Expo docs for "Install expo-router" have the exact snippet.

## How routing works

With expo-router **the folder structure is the navigation**. A file at
`app/(customer)/stocks/[id].tsx` is the screen at `/stocks/123`. There is no navigator
configuration to keep in sync, and no screen is ever hard to find.

The three groups in brackets are the signed-out state and the two role apps:

- `app/(auth)/` — login, register, choose role, profile setup
- `app/(customer)/` — Stocks, Reports, Delivery, Suppliers
- `app/(supplier)/` — Stocks (listings), Orders, Delivery

`app/_layout.tsx` reads the role from the profile once and sends the user into the right group.
Nothing below that point needs to check the role again.

## Where things go

| What | Where |
|---|---|
| A screen | `app/` |
| UI used on more than one screen | `src/components/` |
| A generic control | `src/components/ui/` |
| A backend call | `src/api/` — one file per backend feed, same name |
| Fetching and caching | `src/hooks/` |
| State outliving one screen | `src/stores/` |
| A colour, size or font | `src/theme/` — never a literal in a component |

## Rules

- The app never holds a WhatsApp, email or Firebase key. Those calls go through the backend.
- The app may read Supabase directly for display and realtime; it may not write anything with
  business consequences.
- Types in `src/types/` mirror the backend's `schemas.py`. Regenerate `database.ts` after every
  migration.
