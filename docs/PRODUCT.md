# Product

What this application does, for whom, and the rules that shape it.
[ARCHITECTURE.md](ARCHITECTURE.md) covers how it's built — this file is the behaviour.

One organising committee (S4DS, KJSIT) runs workshops, hackathons and sessions. This replaces
the Google Form + spreadsheet + WhatsApp-broadcast way of doing that, end to end:

> **register → emailed QR ticket → per-day attendance scan → certificate**

Everything is public at `s4ds-events.kjsit.org/<event-slug>`, so a link dropped in a WhatsApp
group is the whole marketing funnel.

## Who uses it

| | Who | Account? | Where they live |
|---|---|---|---|
| **Attendee** | A student with a WhatsApp link, on a phone | **No account, ever** | `/`, `/<slug>`, `/t/<code>` |
| **Volunteer** | Someone on the door with a phone camera | `SCANNER` | `/admin/scan` only |
| **Core member** | Runs events, approves people, sends mail | `ADMIN` | All of `/admin` |
| **Lead** | Also deletes registrations | `OWNER` | All of `/admin` |

**Attendees deliberately have no accounts.** Nobody signs up to sign up. The consequence
runs through the whole product: there is no "my registrations" page, no password reset, no
login wall — a registration is identified by a code that lands in an email, and knowing the
code is the only credential. That's the right trade for a college event, and it's why the
database has no user table for students.

Volunteers are the opposite case: they get an account, but the narrowest one that exists. A
`SCANNER` can open the scanner and nothing else — no registration list, no email queue, no
export. Accounts are created at `/admin/users` before an event and read out to the volunteer;
there's no invite email to chase on the day.

## The attendee journey

**1. Find the event.** The homepage sorts every published event into three sections, computed
server-side so a student's device clock can't disagree:

| Section | Means |
|---|---|
| **Open for registration** | Published, and inside the registration window |
| **Upcoming** | Published and still to come, but registration isn't open right now |
| **Past** | Already finished |

Note what's *not* in that table: being full doesn't move an event out of "open". See the
waitlist below.

**2. Register.** Name, email and phone are always asked. Everything else depends on the
event — a KJSIT-only workshop asks department/year/division, an open event asks
college-or-company and LinkedIn. If the event charges, they see a UPI QR and upload a
screenshot of the payment.

**3. Get a ticket.** No email is ever sent from inside the request — registering queues one
and returns immediately, and a worker sends it a moment later. The ticket lives at
`/t/<code>` and shows a QR plus the current status, spelled out in words rather than by
colour alone.

**4. Turn up.** A volunteer scans the QR. Multi-day events scan once per day.

The ticket page is the single source of truth the attendee keeps coming back to: it changes
as their status changes, and it ticks off each day as they're scanned in.

## Registration states

Five states, and the whole admin workload is moving people between them:

| State | Set by | Holds a seat? | Scannable? |
|---|---|---|---|
| `PENDING` | Registering, when the event doesn't auto-approve | **Yes** | No |
| `APPROVED` | Auto, or an admin | **Yes** | **Yes** |
| `WAITLISTED` | Registering when the event is full | No | No |
| `REJECTED` | An admin | No | No |
| `CANCELLED` | An admin | No | No |

**Only `APPROVED` gets through the door.** That single rule is what makes approval meaningful
for a paid event: the gate between "sent us a screenshot" and "gets in" is a human looking at
it.

**`auto_approve` decides which kind of event this is.** On (the default), registering is
instant and the approval queue stays empty — right for a free internal talk. Off, everyone
starts `PENDING` and someone works through the list — right when you're checking payments.

## Rules worth knowing

**Full doesn't mean closed — it means waitlisted.** The 61st person for 60 seats used to get
an error and vanish; now they're recorded as `WAITLISTED`. Since a waitlisted registration
doesn't hold a seat, rejecting a no-show genuinely frees one, and promoting someone off the
list is just approving them. Capacity is optional; leave it empty for unlimited.

**One registration per email, per event.** Not one globally — the same student registering
for next month's event is the normal case, not an error.

**The QR is not the code.** `KJS-7F3A9C` is the friendly identifier shown on the ticket and
searched by in the admin table. The QR carries a separate 32-byte random token. If the QR
encoded the code, anyone could read one off a friend's screenshot and forge a ticket.

**A second scan is not an error, it's an answer.** Two volunteers scanning the same person is
routine, and the scanner tells them so — `DUPLICATE`, with the time of the first scan.
Everything the scanner can report is distinguishable at a glance, one-handed, outdoors, with
a queue waiting: `OK`, `DUPLICATE`, `NOT_FOUND`, `NOT_APPROVED`, `WRONG_EVENT`. There's a
manual code-entry fallback for when a screen is too cracked or too dim to scan.

**Attendance is per day, not per event.** A two-day workshop has two independently scannable
days, without anything hardcoding "day 1".

**Events live at the site root.** `/<slug>`, not `/events/<slug>` — shorter links get shared
more. The cost is that a slug like `admin` or `api` would shadow a real page, so those names
are blocked when the event is created.

**Emails queue; they never send inline.** A registration that had to wait for Gmail would be
a registration that times out on venue wifi. It also means email volume is a planning
constraint, not a technical one: roughly 500 a day on the current account, so a big
registration push and a certificate batch shouldn't share a day.

**Payment screenshots are private.** They're photos of people's payment apps. They're stored
so that only a signed, expiring link renders them in the admin table — a guessable URL would
be a privacy leak.

## What an admin actually does

- **See what needs attention.** The event list leads with the pending count per event,
  because that's the number that decides whether there's work today.
- **Work the registration list.** Search, filter by status, approve, reject, view the payment
  proof. Approving or rejecting queues the appropriate email automatically — and only on a
  real change of state, so a double-click can't send someone two "you're in" emails.
- **Export CSV.** One column per question that event asked.
- **Watch the email queue.** Every message with its status, and a manual send for when you
  don't want to wait for the worker.
- **Manage the team.** Create `SCANNER` accounts before an event; deactivate them after.
  You can only manage and hand out roles below your own, and role changes and deactivations
  take effect on the person's next request, not their next login.

Accounts are deactivated rather than deleted, so the record of who scanned whom survives.

## Events are created in code, not in the UI

Two deliberate omissions that look like gaps until you know why:

**There is no form builder.** An event's extra questions are a keyed entry in
`src/config/forms/index.ts` — `kjsit-student`, `open-public`, `ai-agents-workshop`,
`minimal`. Adding an event that asks something different is a one-line edit and a deploy. A
drag-and-drop builder is weeks of work and a table of its own, to save an edit that happens
a handful of times a year. Field keys are permanent: renaming one orphans every answer
already collected.

**There is no event create/edit screen** — see the gaps below. Today an event is created by
a script.

## Built vs. not

Honest state of the thing, because ARCHITECTURE.md documents the agreed contract rather than
what currently ships.

**Working end to end:** homepage and event pages · registration with capacity, waitlist,
payment upload · ticket page with QR and per-day attendance · QR and manual scanning · the
admin event list, registration table and CSV export · the email queue, worker and its five
templates (`confirmation`, `waitlisted`, `approved`, `rejected`, `ticket`) · admin accounts
and the three roles.

**Not built yet:**

| Gap | Impact |
|---|---|
| **No event create/edit UI** | Events are made by editing a script and running it — the biggest hole between here and handing this to a non-developer. `/admin` lists events but can't add one. |
| **Certificates** | Schema, config column and the `certificate_enabled` flag exist; nothing generates or sends a PDF. The headline feature in the one-line pitch is the one that isn't there. |
| **`/retrieve`** | "Resend my ticket" is in the contract and on no page. An attendee who deletes the email currently has no self-serve way back to their ticket. |
| **Live scan stats** | The scanner shows individual results, not a running count for the day. |
| **Reminder email** | Listed in the schema comment; no template. |

Nothing in that list is load-bearing for running an event *today* — you can register, ticket
and scan a real crowd right now. The first two are what stand between this and the committee
running it without a developer in the room.
