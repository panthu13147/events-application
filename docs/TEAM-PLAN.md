# Team Plan — 4 people, 4 tracks

Read [ARCHITECTURE.md](ARCHITECTURE.md) first. That document is the contract; this one is who does what.

## The principle

Four people editing one Next.js app will spend more time resolving merge conflicts than writing code — unless **each person owns files nobody else touches**. The tracks below are drawn along file boundaries, not feature boundaries, for exactly that reason.

Two rules make this work:

1. **The schema is frozen after Phase 0.** Need a column? Post in the group; the lead writes a new numbered migration in `supabase/migrations/` and everyone applies it the same day. An applied migration file is never edited.
2. **The API contract is agreed before coding starts.** Track C builds the entire scanner against a mocked response while Track A is still writing the real route. Nobody waits.

## Everyone gets their own database

Supabase's free tier allows 2 projects **per account**, so each of you creates your own free project under your own account and runs the migrations plus the seed there. Production lives in a separate project on the club's account.

Don't share one dev project — `npm run db:seed` wipes everything, and someone will run it while you're mid-test.

---

## Phase 0 — Foundation (lead only)

**Status: code complete.** Listed here so everyone can see what already exists.

- [x] Next.js 16 + TypeScript + Tailwind v4 + ESLint + shadcn/ui base components
- [x] `netlify.toml` + scheduled-function stub
- [x] Schema as SQL: `supabase/migrations/0001_init.sql` — tables, enums, indexes, constraints, RLS
- [x] Atomic operations: `supabase/migrations/0002_functions.sql` — `register_for_event`, `claim_email_jobs`
- [x] `src/lib/supabase.ts` — typed service-role client, lazily constructed, `server-only`
- [x] `src/lib/database.types.ts` — hand-written for now; `npm run db:types` regenerates it once the Supabase CLI is linked
- [x] Admin auth: `src/lib/session.ts` (edge-safe jose), `src/lib/password.ts` (bcrypt, node-only), `src/lib/auth.ts` (`requireRole`, `withAuth`), `src/proxy.ts` (route + role gate), login page + routes
- [x] `src/lib/reserved-slugs.ts`, `src/config/forms/index.ts`, `src/lib/form-types.ts`, `src/lib/validation.ts`, `src/lib/ids.ts`
- [x] `scripts/seed.ts` — 3 events (open / upcoming / past), 38 registrations, partial attendance, 3 admin roles
- [ ] Deploy to Netlify and **confirm `@netlify/plugin-nextjs` builds Next 16**. Do this before writing feature code — finding out in week 3 is expensive
- [ ] **CNAME request to college IT for `s4ds-events.kjsit.org`** — longest lead time of anything here, start it now
- [ ] Cloudinary account + unsigned preset `event_uploads` (images only, 5MB cap, auto-compress)

**Done when:** anyone can clone, create their own Supabase project, run the two migrations, `npm run db:seed`, `npm run dev`, and sign in at `/admin/login` with seeded data visible.

---

## Track A — Admin core & event management

**Best for:** the strongest dev. Also owns the schema and reviews everyone's PRs.

| | |
|---|---|
| **Owns** | `src/app/admin/**` (except `scan/`), `src/app/api/admin/events/**`, `src/app/api/admin/registrations/**`, `src/app/api/admin/login`, `src/lib/auth.ts`, `src/proxy.ts`, `supabase/migrations/**` |
| **Never touches** | public pages, scanner, email/certificate code |

- Admin shell: sidebar, event switcher, role-aware nav
- **Event create/edit**: every event column, multi-day builder (`event_days` rows), banner + UPI QR upload to Cloudinary, `form_key` from a dropdown populated by the registry (**no drag-drop builder** — form fields live in code)
- **Slug validation**: lowercase-kebab, unique, rejected if in `RESERVED_SLUGS`. Already in the Zod schema — keep it enforced server-side; a bad slug shadows a real route and is near-impossible to debug later
- Draft → Publish → Close lifecycle, with a preview of what students will see
- Registrations table: search, filter by status, pagination, approve/reject, view payment proof
- CSV export — one column per key in the event's form registry entry
- Admin user management (invite ADMIN / SCANNER accounts)

**Done when:** an admin can create a 2-day paid event pointing at a form registry key, publish it, and approve a registration — without touching the database.

---

## Track B — Public site & registration

**Best for:** the strongest frontend/design person. This is what 300 students actually see.

| | |
|---|---|
| **Owns** | `src/app/page.tsx`, `src/app/[slug]/**`, `src/app/t/**`, `src/app/retrieve/**`, `src/app/api/events/**`, `src/app/api/tickets/**`, `src/components/form-renderer/**`, `src/lib/cloudinary-client.ts` |
| **Never touches** | `/admin`, scanner, email sending |

- **Homepage**: three sections — Open for registration / Upcoming / Past. Compute "now" server-side; browser clocks disagree
- **`/[slug]`** — event page: banner, description, dates, venue, day list, spots left. Must `notFound()` on reserved or unpublished slugs
- **Form renderer** — reads `FieldDef[]` from the API and renders the right input per `type`, with the Zod schema built from the same array via `buildAnswersSchema()`. Core of this track. Fail loudly on an unknown field type rather than silently dropping it
- Payment section, conditional on `requires_payment`: UPI QR + proof upload **direct to Cloudinary** (compress client-side to ~1200px first — a 4MB POST through a Netlify function will fail)
- `POST /api/events/[slug]/register` — **must call the `register_for_event` RPC**, never a count-then-insert. Map its errors (`CAPACITY_FULL`, `REGISTRATION_CLOSED`, `DUPLICATE_EMAIL`) to friendly messages, then `enqueueEmail()` and redirect
- **`/t/[code]`** — ticket: QR encoding `qr_token`, name, event, per-day check-in status, add-to-calendar, save-as-image
- `/retrieve` — email + event, always returns 202, queues the mail
- Mobile-first throughout. Most students open this from a WhatsApp link on a phone

**Done when:** a phone can go homepage → event → filled form → paid → working QR ticket, with no admin intervention.

---

## Track C — Scanner & live attendance

**Best for:** a beginner. Small, self-contained, visually satisfying, and touches nobody else's files.

| | |
|---|---|
| **Owns** | `src/app/admin/scan/**`, `src/app/api/admin/scan`, `src/app/api/admin/events/[id]/stats` |
| **Never touches** | everything else |

- `/admin/scan` — pick event + day, then camera view. Accessible to the SCANNER role
- `POST /api/admin/scan`: look up by `qr_token`, verify event matches, verify APPROVED, insert into `attendance`, and **catch the unique-constraint violation** (`isUniqueViolation()` from `src/lib/supabase.ts`) to return `DUPLICATE`. Return exactly the shapes in the contract
- **Result UI**: full-screen green / amber / red + name + sound. A volunteer must read it in under a second, one-handed, outdoors, with a queue waiting. Design for that, not for a desktop screen
- **Manual fallback**: search by `code` or name and check in without the camera. A phone camera *will* fail on event day
- Live stats bar — `47 / 120 checked in today`, polling every 10s
- Test on a real phone in week 1. Camera APIs need HTTPS: use the **Netlify deploy preview URL**, not `localhost`

**Done when:** two phones scan the same ticket and the second gets an unmistakable DUPLICATE screen.

---

## Track D — Email, jobs & certificates

**Best for:** the other beginner, or whoever prefers backend. Mostly library code, few UI decisions, easy to test in isolation.

| | |
|---|---|
| **Owns** | `src/lib/email/**`, `src/lib/certificates/**`, `src/emails/**`, `src/app/api/cron/**`, `src/app/api/admin/events/[id]/certificates`, `netlify/functions/**` |
| **Never touches** | any page except a certificate-preview admin page |

- **Week 1, first deliverable: ship `enqueueEmail()` as a stub** that just inserts an `email_jobs` row. It's the only function other tracks call — they integrate on day 3, not week 4
- `src/lib/email/send.ts` — nodemailer + Gmail SMTP behind a `sendEmail()` interface. The **only** file that knows the provider, so it can be swapped in one place
- React Email templates: **confirmation** (QR + ticket link), **ticket retrieval**, **approved/rejected**, **day-before reminder**, **certificate delivery**. Always include a plain-text alternative — it materially affects spam placement
- **`/api/cron/process-emails`** — call `db.rpc('claim_email_jobs', { p_limit: 5 })`, send each, mark SENT/FAILED with backoff. The RPC already handles atomic claiming and recovering jobs stuck in `SENDING`; don't reimplement that in JS. Guarded by `CRON_SECRET`
- **`netlify/functions/process-emails.ts`** — already wired, scheduled every minute. Netlify's ~10s function timeout is why the batch is 5
- **Certificate generation is a separate job type in the same queue** — generating 200 PDFs inline will time out. `pdf-lib` loads the template, overlays name/event/date/serial from `certificate_config`, uploads to Cloudinary as `resource_type: 'raw'`
- "Issue certificates": find registrations whose attendance count equals the event's day count, queue generation. **Idempotent** — `certificates.registration_id` is unique; rely on it
- Admin preview page: render one certificate with dummy data so the design can be checked without emailing anyone
- **Send a test email to a non-Gmail address** (Outlook/Yahoo) early and check whether it landed in spam. Week 1, not the week of the event

**Done when:** seed 5 fully-attended registrations, click issue, and 5 correct PDFs arrive — with the 6th person who missed a day correctly skipped.

---

## Timeline

| Week | Track A (lead) | Track B | Track C | Track D |
|---|---|---|---|---|
| **1** | Event create/edit | Homepage + `/[slug]` + form renderer | Scanner UI against a mocked API | `enqueueEmail` stub + Gmail SMTP + confirmation template + spam test |
| **2** | Days builder, slug rules, registrations table | Register RPC + ticket page | Real scan API + duplicate handling + stats | Cron worker + PDF generation |
| **3** | Approvals, CSV, admin users | Payment flow + retrieve + mobile polish | Manual fallback + on-phone testing | Issue-certificates + remaining templates |
| **4** | **Everyone:** integration, full dry run with real people, bug fixes, DNS cutover |

Week 4 is not padding. Do a real dry run: 10 friends register, you scan them across two "days", you issue certificates. Every problem found there is one you'd otherwise find in front of 300 people.

## Conventions

- Branches: `track-a/event-crud`, `track-b/form-renderer` — the prefix makes ownership obvious
- Every change goes through a PR; the lead reviews. Nobody pushes to `main`
- Small PRs merged often. A branch open for a week is a merge conflict with a countdown
- Pull `main` and rebase every morning
- Commits: `feat(scanner): add duplicate detection`
- Netlify builds a **deploy preview per PR** — check yours there before requesting review
- Never commit `.env`. Never paste secrets in the group chat

## Definition of done

1. Works locally against seeded data
2. Handles empty, loading, and error states — not just the happy path
3. Works on a phone screen
4. `npm run typecheck` and `npm run lint` clean
5. Verified on the Netlify deploy preview, not only on localhost

## Decide in week 1 — don't let these drift

- [ ] **Which Gmail account sends** — a dedicated `s4ds.events@` account, not a person's. Enable 2FA, generate the app password. Better still: ask whether the college can give you a Workspace account on `kjsit.org`, far more trusted by spam filters
- [ ] **CNAME request to college IT** for `s4ds-events.kjsit.org`
- [ ] Who owns the production Supabase / Netlify / Cloudinary / Gmail accounts, and how credentials are shared
- [ ] **Certificate template design** — someone must produce the background PNG plus the text coordinates. Not a coding task, so it gets forgotten until the last week
- [ ] Confirm Netlify's function timeout on your plan, so Track D sizes the email batch correctly
- [ ] A standing reminder to check the Supabase project hasn't paused before each event — the free tier pauses after ~7 days idle and needs a manual restore
