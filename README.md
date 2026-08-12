# S4DS Events

Event registration → emailed QR ticket → per-day attendance scanning → certificates.
Live at `s4ds-events.kjsit.org`, events published at `/<event-slug>`.

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — stack, data model, API contract. **The contract.**
- [docs/TEAM-PLAN.md](docs/TEAM-PLAN.md) — who owns which files, timeline, conventions.

## Setup

**Requires Node 20.19+.**

```bash
npm install
```

### 1. Your own Supabase project

Supabase's free tier gives 2 projects **per account**, so create your own project under your own account. Don't share a dev project with a teammate — `npm run db:seed` wipes everything.

### 2. Run the migrations

In the Supabase dashboard → **SQL Editor**, run these in order:

1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_functions.sql`

### 3. Environment

Copy `.env.example` to `.env`. From **Project Settings → API** in Supabase:

- `SUPABASE_URL` — the project URL
- `SUPABASE_SERVICE_ROLE_KEY` — the `service_role` key, **not** `anon`

Generate the two secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Seed and run

```bash
npm run db:seed
npm run dev
```

Open http://localhost:3000. Sign in at `/admin/login` with the credentials the seed prints:

| Role | Email | Password |
|---|---|---|
| OWNER | `admin@s4ds.local` | `changeme123` |
| ADMIN | `core@s4ds.local` | `changeme123` |
| SCANNER | `volunteer@s4ds.local` | `changeme123` |

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run typecheck` | `tsc --noEmit` — run before opening a PR |
| `npm run lint` | ESLint |
| `npm run db:seed` | **Wipes** and reseeds your dev database |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` (needs the Supabase CLI + `SUPABASE_PROJECT_ID`) |

## Things that will trip you up

- **Never edit an applied migration.** Schema changes get a new numbered file in `supabase/migrations/`, and the lead writes them. Ask in the group first.
- **If you change SQL, update `src/lib/database.types.ts` in the same commit.** A mismatch type-checks fine and fails at runtime.
- **There are no transactions.** `supabase-js` can't read-decide-write atomically. Anywhere a race would corrupt data, the logic is a Postgres function called with `db.rpc(...)` — see `supabase/migrations/0002_functions.sql`. Registration **must** go through `register_for_event`, not a count-then-insert.
- **`service_role` bypasses Row Level Security**, so our route handlers are the only thing protecting the data. Every admin route calls `requireRole()`. The key is server-only — `src/lib/supabase.ts` imports `server-only` so the build fails if a client component touches it.
- **`src/proxy.ts` runs on the edge.** (Next 16 renamed the middleware convention to `proxy`.) No database, no bcrypt — only `jose`. Anything Node-only there builds fine and fails on every request.
- **The proxy is not the authorization boundary.** It redirects humans. Route handlers do the real check.
- **Event slugs live at the site root**, so they can collide with real routes. `src/lib/reserved-slugs.ts` blocks that, enforced in the Zod schema.
- **Camera access needs HTTPS.** Test the scanner on a phone using the Netlify deploy preview URL, never `localhost`.
- **The free Supabase tier pauses after ~7 days idle** and needs a manual restore from the dashboard. If the app suddenly can't reach the database after a quiet week, check there first.

## Form fields

There's deliberately no drag-and-drop builder. An event's extra questions live in
[`src/config/forms/index.ts`](src/config/forms/index.ts), keyed by `events.form_key`.
Adding an event that asks different questions is a one-line edit there plus a deploy.

A field `key` is permanent — renaming one orphans the answers already collected.

## Deploying

Netlify builds on every push; each PR gets a deploy preview. Environment variables are set in
the Netlify UI (never committed). Migrations are **not** applied automatically — run new ones
in the Supabase SQL editor against the production project, before merging the code that needs them.
