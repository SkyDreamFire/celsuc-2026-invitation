-- Migration: Fix auth.users for GoTrue compatibility
--
-- Problem: Direct insert into auth.users was missing instance_id
-- and pgcrypto's bcrypt cost factor may differ from GoTrue's expected format.
-- Fix: Set instance_id to the default value and re-hash passwords with cost 10.

-- Re-hash passwords with cost factor 10 (GoTrue default) and fix instance_id
UPDATE auth.users
SET
  instance_id = '00000000-0000-0000-0000-000000000000',
  encrypted_password = extensions.crypt('AdminIUC123', extensions.gen_salt('bf', 10)),
  is_sso_user = false,
  updated_at = now()
WHERE email LIKE '%@celsuc.iuc';
