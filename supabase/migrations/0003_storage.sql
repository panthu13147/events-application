-- Storage bucket for payment screenshots.
--
-- Run this in the SQL Editor like the others. It can't be created through the
-- REST API with an API key — bucket creation is blocked by RLS on
-- storage.buckets, so it has to happen here (or via the dashboard UI).
--
-- Private bucket: uploads and reads both go through our own server code using
-- the service key. Nothing is publicly listable, which matters because these
-- are screenshots of people's payment apps.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880,                                   -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
