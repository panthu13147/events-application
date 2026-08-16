-- Replace the claim_email_jobs function to optionally exclude certificates
drop function if exists claim_email_jobs(integer);

create or replace function claim_email_jobs(p_limit integer default 5, p_include_certificates boolean default false)
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
      where (status = 'QUEUED' or (status = 'SENDING' and locked_at < now() - interval '5 minutes'))
        and (template != 'certificate' or p_include_certificates = true)
      order by created_at
      limit p_limit
        for update skip locked
   )
  returning *;
end;
$$;

revoke execute on function claim_email_jobs(integer, boolean) from anon, authenticated;
