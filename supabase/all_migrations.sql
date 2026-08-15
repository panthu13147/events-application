-- Run this in the Supabase SQL Editor to apply missing migrations:

-- 1. Add is_active to admin_users
alter table admin_users
  add column is_active boolean not null default true;

-- 2. Create certificate_jobs table
create table certificate_jobs (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid references registrations(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  status job_status not null default 'QUEUED',
  error_msg text,
  created_at timestamptz not null default now()
);

-- 3. Add RLS policy for certificate_jobs
alter table certificate_jobs enable row level security;
