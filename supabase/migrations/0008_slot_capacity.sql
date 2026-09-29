-- Per-answer capacity: a cap that applies to each distinct answer to one
-- question, rather than to the event as a whole.
--
-- Driven by the Mahakumbh Hackathon, where 3 teams are taken per problem
-- statement and a statement that already has 3 must stop accepting teams while
-- the other eleven stay open. The event-level `capacity` can't express that —
-- it only knows the total.
--
-- Generic rather than hard-coded to `problem_statement` because the mechanism
-- is not specific to it: any event with a "pick one track / slot / session"
-- question wants exactly this, and a column costs less than a second function.

alter table events
  -- Key in `registrations.answers` whose value partitions the capacity, e.g.
  -- 'problem_statement'. NULL (the default) = no per-answer cap, which is every
  -- event that existed before this migration.
  add column slot_answer_key text,
  -- How many registrations each distinct answer accepts.
  add column slot_capacity integer;

alter table events
  add constraint events_slot_capacity_positive
    check (slot_capacity is null or slot_capacity > 0),
  -- Half a configuration is the dangerous state: a key with no number silently
  -- enforces nothing, and a number with no key has nothing to count. Both or
  -- neither.
  add constraint events_slot_config_complete
    check ((slot_answer_key is null) = (slot_capacity is null));

-- No new index. The count below is driven by `registrations_event_status_idx`
-- (event_id, status) from 0001, which narrows to one event's live rows; the
-- answers are then filtered from the heap. Adding `include (answers)` to cover
-- it would be actively dangerous: `answers` is jsonb holding a 500-character
-- textarea on some events, and a btree index row over ~2704 bytes is a hard
-- error on INSERT — it would break registration for exactly the people whose
-- answers are longest.

-- ---------------------------------------------------------------------------
-- register_for_event, with the per-answer cap
--
-- Everything else is unchanged from 0004_waitlist.sql. The new block sits
-- BEFORE the event-level capacity check: a full slot is a hard stop, so there
-- is no point working out whether a waitlist seat was available.
--
-- WHY IN HERE AND NOT IN THE ROUTE HANDLER: the `select ... for update` at the
-- top serialises everyone registering for this event, so the count below cannot
-- be stale by the time the insert runs. The same check in TypeScript would let
-- two teams read "2 taken" at the same moment and both become the third.
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
  v_event     events%rowtype;
  v_taken     integer;
  v_slot      text;
  v_slot_used integer;
  v_status    reg_status;
  v_row       registrations%rowtype;
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

  -- --- per-answer capacity -------------------------------------------------
  if v_event.slot_answer_key is not null then
    v_slot := p_answers ->> v_event.slot_answer_key;

    -- A blank answer can't be counted against a slot, and letting it through
    -- would be an unlimited back door around the cap. The route validates the
    -- field as required, so reaching here means someone bypassed the form.
    if v_slot is null or v_slot = '' then
      raise exception 'SLOT_MISSING';
    end if;

    -- PENDING and APPROVED hold a slot; REJECTED and CANCELLED release it, so
    -- an admin rejecting a team genuinely reopens the place for someone else.
    -- WAITLISTED holds nothing, exactly as it holds no seat.
    select count(*) into v_slot_used
      from registrations
     where event_id = p_event_id
       and status in ('PENDING', 'APPROVED')
       and answers ->> v_event.slot_answer_key = v_slot;

    -- A hard stop, not a waitlist. The other slots are still open, so the
    -- useful thing to tell someone is "pick another one", not "wait and see".
    if v_slot_used >= v_event.slot_capacity then
      raise exception 'SLOT_FULL';
    end if;
  end if;

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
