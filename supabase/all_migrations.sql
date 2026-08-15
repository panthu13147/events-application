-- S4DS Events — initial schema
-- Run this in the Supabase SQL Editor (or `supabase db push` with the CLI).
--
-- FROZEN after Phase 0. Need a column? Ask the lead — new migrations get a new
-- numbered file, this one is never edited once it has been applied.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type event_status as enum ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED');
create type reg_status   as enum ('PENDING', 'APPROVED', 'REJECTED', 'WAITLISTED', 'CANCELLED');
-- SCANNER = event-day volunteer. Can open the scanner and nothing else.
create type admin_role   as enum ('OWNER', 'ADMIN', 'SCANNER');
create type job_status   as enum ('QUEUED', 'SENDING', 'SENT', 'FAILED');

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------

create table events (
  id uuid primary key default gen_random_uuid(),

  -- Lives at the ROOT of the site: 'llm-masterclass' -> /llm-masterclass.
  -- Must never collide with a real route — see src/lib/reserved-slugs.ts
  slug        text not null unique,
  title       text not null,
  tagline     text,
  description text,                     -- markdown
  venue       text,
  banner_url  text,                     -- Cloudinary

  -- Key into the FORMS registry in src/config/forms. The extra questions this
  -- event asks live in code, not in the database.
  form_key text not null default 'kjsit-student',

  starts_at timestamptz not null,
  ends_at   timestamptz not null,
  capacity  integer,                    -- null = unlimited
  status    event_status not null default 'DRAFT',

  registration_opens_at  timestamptz,
  registration_closes_at timestamptz,

  requires_payment boolean not null default false,
  fee_amount       integer,             -- paise. 250 rupees = 25000. Never a float.
  payment_qr_url   text,                -- UPI QR (Cloudinary)
  -- false = every registration starts PENDING and an admin approves it
  auto_approve     boolean not null default true,

  certificate_enabled      boolean not null default false,
  certificate_template_url text,
  certificate_config       jsonb,       -- { name: { x, y, size }, ... }

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint events_dates_valid check (ends_at >= starts_at),
  constraint events_capacity_positive check (capacity is null or capacity > 0)
);

-- Drives the three homepage sections (open / upcoming / past)
create index events_status_starts_at_idx on events (status, starts_at);

create trigger events_set_updated_at
  before update on events
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- event_days
-- Attendance hangs off a day, not an int — this is what makes multi-day work.
-- ---------------------------------------------------------------------------

create table event_days (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events (id) on delete cascade,
  day_number integer not null,
  label      text,                      -- 'Day 1 — Fundamentals'
  date       timestamptz not null,

  unique (event_id, day_number),
  constraint event_days_number_positive check (day_number > 0)
);

create index event_days_event_id_idx on event_days (event_id);

-- ---------------------------------------------------------------------------
-- registrations
-- ---------------------------------------------------------------------------

create table registrations (
  id       uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,

  -- Friendly, shown to the student and searchable in admin: KJS-7F3A9C
  code     text not null unique,
  -- 32 random bytes. THIS is what the QR encodes — never `code`, or tickets
  -- become forgeable and anyone can mark themselves present.
  qr_token text not null unique,

  full_name text not null,
  email     text not null,
  phone     text,
  -- Answers to the event's form_key fields, keyed by FieldDef.key
  answers   jsonb not null default '{}'::jsonb,

  status            reg_status not null default 'APPROVED',
  payment_proof_url text,                -- Cloudinary. Never the image itself.

  created_at timestamptz not null default now(),

  -- Per-event, NOT global. A global unique email would mean a student can
  -- register for exactly one event ever.
  unique (event_id, email)
);

create index registrations_event_status_idx on registrations (event_id, status);
create index registrations_email_idx on registrations (email);

-- ---------------------------------------------------------------------------
-- attendance
-- ---------------------------------------------------------------------------

create table attendance (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registrations (id) on delete cascade,
  event_day_id    uuid not null references event_days (id) on delete cascade,
  scanned_at      timestamptz not null default now(),
  scanned_by      text,                  -- admin_users.id of the volunteer

  -- Duplicate-scan prevention at the DB level. The scan API catches the
  -- violation from this constraint (code 23505) and returns DUPLICATE.
  unique (registration_id, event_day_id)
);

create index attendance_event_day_idx on attendance (event_day_id);

-- ---------------------------------------------------------------------------
-- certificates
-- ---------------------------------------------------------------------------

create table certificates (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references registrations (id) on delete cascade,
  serial          text not null unique,  -- S4DS/2026/LLM/0042
  pdf_url         text not null,         -- Cloudinary raw upload
  issued_at       timestamptz not null default now(),
  emailed_at      timestamptz
);

-- ---------------------------------------------------------------------------
-- admin_users
-- ---------------------------------------------------------------------------

create table admin_users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  name          text not null,
  role          admin_role not null default 'SCANNER',
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- email_jobs
-- Nothing is ever sent inline in a request. Registration writes a row here and
-- returns; a Netlify scheduled function drains the queue a few at a time.
-- ---------------------------------------------------------------------------

create table email_jobs (
  id       uuid primary key default gen_random_uuid(),
  "to"     text not null,
  -- confirmation | ticket | approved | rejected | reminder | certificate
  template text not null,
  payload  jsonb not null default '{}'::jsonb,

  registration_id uuid references registrations (id) on delete set null,

  status     job_status not null default 'QUEUED',
  attempts   integer not null default 0,
  -- Claim marker. Set when a worker takes the job so two overlapping cron runs
  -- can never send the same email twice.
  locked_at  timestamptz,
  last_error text,
  sent_at    timestamptz,

  created_at timestamptz not null default now()
);

create index email_jobs_status_created_idx on email_jobs (status, created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Every table is RLS-enabled with NO policies, which denies all access to the
-- anon and authenticated keys. All reads and writes go through our own server
-- code using the service_role key, which bypasses RLS.
--
-- This is deliberate: students have no accounts, so there is no user identity
-- for a policy to key off. Our route handlers are the authorization boundary.
--
-- Consequence: the service_role key must NEVER reach the browser. It is not
-- prefixed NEXT_PUBLIC_ and must stay out of client components.
-- ---------------------------------------------------------------------------

alter table events        enable row level security;
alter table event_days    enable row level security;
alter table registrations enable row level security;
alter table attendance    enable row level security;
alter table certificates  enable row level security;
alter table admin_users   enable row level security;
alter table email_jobs    enable row level security;
-- Atomic operations.
--
-- supabase-js has no interactive transactions — you cannot read, decide, and
-- write inside one transaction from application code the way Prisma's
-- $transaction allowed. Anything where a read-then-write race would corrupt
-- data has to live in the database as a function, called via db.rpc(...).
--
-- There are exactly two such places in this app. Both are below. If you find
-- yourself writing "read, check, then insert" in a route handler, it probably
-- belongs here instead.

-- ---------------------------------------------------------------------------
-- register_for_event
--
-- The race: two students submit for the last remaining spot at the same time.
-- Both read count = 69 against a capacity of 70, both pass the check, both
-- insert, and the event is oversubscribed.
--
-- Locking the event row serialises concurrent registrations for that event.
--
-- Raises:
--   CAPACITY_FULL      event is at capacity
--   REGISTRATION_CLOSED  outside the registration window / not published
--   DUPLICATE_EMAIL    this email already registered for this event
-- ---------------------------------------------------------------------------

create or replace function register_for_event(
  p_event_id           uuid,
  p_code               text,
  p_qr_token           text,
  p_full_name          text,
  p_email              text,
  p_phone              text default null,
  p_answers            jsonb default '{}'::jsonb,
  p_payment_proof_url  text default null
)
returns registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event  events%rowtype;
  v_taken  integer;
  v_status reg_status;
  v_row    registrations%rowtype;
begin
  -- FOR UPDATE serialises everyone registering for this event.
  select * into v_event from events where id = p_event_id for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  if v_event.status <> 'PUBLISHED'
     or (v_event.registration_opens_at is not null and now() < v_event.registration_opens_at)
     or (v_event.registration_closes_at is not null and now() > v_event.registration_closes_at)
  then
    raise exception 'REGISTRATION_CLOSED';
  end if;

  if v_event.capacity is not null then
    -- Rejected registrations don't hold a spot; pending ones do.
    select count(*) into v_taken
      from registrations
     where event_id = p_event_id
       and status <> 'REJECTED'
       and status <> 'CANCELLED';

    if v_taken >= v_event.capacity then
      raise exception 'CAPACITY_FULL';
    end if;
  end if;

  v_status := case when v_event.auto_approve then 'APPROVED'::reg_status
                   else 'PENDING'::reg_status end;

  begin
    insert into registrations (
      event_id, code, qr_token, full_name, email, phone,
      answers, status, payment_proof_url
    )
    values (
      p_event_id, p_code, p_qr_token, p_full_name, lower(p_email), p_phone,
      p_answers, v_status, p_payment_proof_url
    )
    returning * into v_row;
  exception when unique_violation then
    raise exception 'DUPLICATE_EMAIL';
  end;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- claim_email_jobs
--
-- The race: the Netlify schedule fires every minute, but a slow run can still
-- be sending when the next one starts. Without an atomic claim both runs read
-- the same QUEUED rows and every recipient gets the email twice.
--
-- FOR UPDATE SKIP LOCKED lets overlapping workers take disjoint batches
-- instead of blocking on each other.
--
-- Also recovers jobs stuck in SENDING for over 5 minutes — that's a worker
-- that crashed or timed out, not one still in flight.
-- ---------------------------------------------------------------------------

create or replace function claim_email_jobs(p_limit integer default 5)
returns setof email_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update email_jobs
     set status    = 'SENDING',
         locked_at = now(),
         attempts  = attempts + 1
   where id in (
     select id
       from email_jobs
      where status = 'QUEUED'
         or (status = 'SENDING' and locked_at < now() - interval '5 minutes')
      order by created_at
      limit p_limit
        for update skip locked
   )
  returning *;
end;
$$;

-- These are called with the service_role key from our own server code only.
revoke execute on function register_for_event(uuid, text, text, text, text, text, jsonb, text) from anon, authenticated;
revoke execute on function claim_email_jobs(integer) from anon, authenticated;
-- Waitlist instead of a hard stop at capacity.
--
-- Before: the 61st person for a 60-seat event got CAPACITY_FULL and nothing
-- else happened — we lost them, and if someone dropped out we had no idea who
-- to offer the seat to.
--
-- After: they're recorded as WAITLISTED. Promoting is just approving them.
--
-- A WAITLISTED registration does NOT hold a seat, so rejecting or deleting an
-- approved person genuinely frees one. That's what makes promotion work.

create or replace function register_for_event(
  p_event_id           uuid,
  p_code               text,
  p_qr_token           text,
  p_full_name          text,
  p_email              text,
  p_phone              text default null,
  p_answers            jsonb default '{}'::jsonb,
  p_payment_proof_url  text default null
)
returns registrations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event  events%rowtype;
  v_taken  integer;
  v_status reg_status;
  v_row    registrations%rowtype;
begin
  -- FOR UPDATE serialises everyone registering for this event, so two people
  -- can't both take the last seat.
  select * into v_event from events where id = p_event_id for update;

  if not found then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  -- Being full no longer closes registration; the window and status still do.
  if v_event.status <> 'PUBLISHED'
     or (v_event.registration_opens_at is not null and now() < v_event.registration_opens_at)
     or (v_event.registration_closes_at is not null and now() > v_event.registration_closes_at)
  then
    raise exception 'REGISTRATION_CLOSED';
  end if;

  v_status := case when v_event.auto_approve then 'APPROVED'::reg_status
                   else 'PENDING'::reg_status end;

  if v_event.capacity is not null then
    -- Only PENDING and APPROVED hold a seat.
    select count(*) into v_taken
      from registrations
     where event_id = p_event_id
       and status in ('PENDING', 'APPROVED');

    if v_taken >= v_event.capacity then
      v_status := 'WAITLISTED';
    end if;
  end if;

  begin
    insert into registrations (
      event_id, code, qr_token, full_name, email, phone,
      answers, status, payment_proof_url
    )
    values (
      p_event_id, p_code, p_qr_token, p_full_name, lower(p_email), p_phone,
      p_answers, v_status, p_payment_proof_url
    )
    returning * into v_row;
  exception when unique_violation then
    raise exception 'DUPLICATE_EMAIL';
  end;

  return v_row;
end;
$$;

revoke execute on function register_for_event(uuid, text, text, text, text, text, jsonb, text) from anon, authenticated;
