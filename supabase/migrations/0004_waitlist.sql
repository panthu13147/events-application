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
