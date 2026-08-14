create table certificate_jobs (
  id              uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registrations (id) on delete cascade,
  event_id        uuid not null references events (id) on delete cascade,
  status          job_status not null default 'QUEUED',
  error_msg       text,
  created_at      timestamptz not null default now(),

  -- Prevent queuing the same certificate multiple times for the same registration
  unique (registration_id)
);

create index certificate_jobs_status_idx on certificate_jobs (status);
create index certificate_jobs_event_id_idx on certificate_jobs (event_id);
