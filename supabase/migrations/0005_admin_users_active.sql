-- ---------------------------------------------------------------------------
-- Deactivating an admin account instead of deleting it.
--
-- attendance.scanned_by stores an admin_users.id as plain text with no foreign
-- key, so deleting a volunteer after an event would leave every row they
-- scanned pointing at an id that no longer resolves. Flipping a flag keeps the
-- audit trail intact and is reversible when the same person volunteers again.
--
-- Enforced in src/lib/auth.ts (requireRole) and the login route, not by RLS —
-- every table here is RLS-enabled with no policies and all access uses the
-- service_role key, so our route handlers remain the authorization boundary.
-- ---------------------------------------------------------------------------

alter table admin_users
  add column is_active boolean not null default true;
