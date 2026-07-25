# Nitin Inventory

Inventory in/out for an events crew. Phone-first PWA for the people carrying
gear, desktop admin console for whoever owns the master sheet.

- **No scanning.** People log in with an employee code and type what they take.
- **Append-only ledger.** Stock is always derived, never a number someone edits.
- **Offline-first.** The store room and the venue both have bad signal.

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
```

Without credentials the app shows a setup screen rather than a blank page.

### Database — hosted Supabase (no Docker)

1. Create a free project at [supabase.com](https://supabase.com/dashboard).
2. Copy `.env.example` to `.env.local` and paste the **Project URL** and the
   **anon public** key from the project's API settings.
3. Apply the schema and demo data:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npm run db:seed        # schema + demo data (dev only)
```

`db:seed` applies the migrations *and* loads `supabase/seed.sql`. For schema
only — which is what you'd run against anything real — use `npm run db:push`.

Or paste `supabase/migrations/20260725000100_init.sql` and then
`supabase/seed.sql` into the dashboard's SQL editor, in that order.

Every seeded login uses PIN **123456** — try `NITIN` (admin), `RAVI` (manager)
or `AMIT` (crew).

### Database — local via Docker (optional)

If you'd rather iterate offline with instant resets:

```bash
npm run db:start
npm run db:reset       # rebuild from migrations + seed
npm run db:types       # regenerate src/lib/database.types.ts
```

## Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server, reachable from a phone on the same network |
| `npm run build` | Typecheck then production build (emits the service worker) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest — the ledger-math suite is the one that must stay green |

## Notes

- `@rolldown/binding-win32-x64-msvc` is pinned in `optionalDependencies` as a
  workaround for npm not installing Vite 8's native binary transitively. It is
  platform-gated, so installs on macOS/Linux skip it harmlessly.
- Secrets: the browser only ever sees `VITE_SUPABASE_URL` and the anon key.
  The Groq key and the service-role key live as Supabase function secrets.
