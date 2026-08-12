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
