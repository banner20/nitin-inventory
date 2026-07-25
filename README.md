# Nitin Inventory

Stock in/out for a bar events company. Phone-first PWA for the crew loading
the van, desktop admin console for whoever owns the master sheet.

- **No scanning.** People log in with an employee code and type what they take.
- **Append-only ledger.** Stock is always derived, never a number someone edits.
- **Offline-first.** The store room and the venue both have bad signal.

Bar stock isn't AV gear, and the schema reflects that:

- **Fractional quantities.** A bottle is 750 ml and a pour is 30 ml, so a half
  bottle coming back is representable rather than rounded away.
- **Packs.** Stock is held in a base unit but entered and shown in bottles,
  crates and bags — nobody types "4500" at 6am.
- **Returnable vs consumable.** Glassware is expected back; gin isn't. Not
  returning a consumable is the normal outcome, not a loss.
- **Honest outcomes.** A returned line is `ok`, `damaged`, `consumed`,
  `wasted` or `lost`. All but the first two reduce what you own; they're kept
  apart because when the stock is liquor, the difference between "we sold it"
  and "it's unaccounted for" is the whole point.
- **Recipes** (`recipes`, `recipe_lines`) describe what a drink should use.
  They're advisory — the ledger never reads them.

Load `supabase/seed_bar_catalog.sql` for a starter catalogue: 78 items across
spirits, mixers, garnishes, ice, glassware and equipment, plus 10 classic
recipes. Catalogue only — no accounts, no invented stock.

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
3. Apply the schema:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npm run db:push        # schema only — use this on any real project
```

Or paste the files in `supabase/migrations/` into the dashboard's SQL editor,
in filename order.

`npm run db:seed` additionally loads `supabase/seed.sql`, which creates six
demo accounts whose password is `123456`. Fine on a throwaway local database,
a bad idea anywhere reachable from the internet.

### Creating the first account

Accounts are admin-created — nobody can sign themselves up. Once the schema is
applied, create the first admin from the Supabase SQL editor:

```sql
select create_app_user('NITIN', 'Nitin Kulkarni', 'your-password', 'admin');
```

After that everything happens in the app under **Admin → People**: add crew,
assign roles, reset passwords, deactivate people who leave. Passwords are
bcrypt-hashed on save, so they can be reset but never read back.

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
