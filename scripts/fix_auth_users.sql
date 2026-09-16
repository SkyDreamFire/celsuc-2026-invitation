-- Fix all NULL string values in auth.users that crash GoTrue
UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  reauthentication_token = COALESCE(reauthentication_token, ''),
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb),
  raw_app_meta_data = COALESCE(raw_app_meta_data, '{"provider":"email","providers":["email"]}'::jsonb),
  is_super_admin = COALESCE(is_super_admin, false)
WHERE email LIKE '%@celsuc.iuc';

-- Also insert missing identities for each user in auth.identities
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  id,
  id,
  json_build_object('sub', id::text, 'email', email)::jsonb,
  'email',
  id::text,
  now(),
  created_at,
  updated_at
FROM auth.users
WHERE email LIKE '%@celsuc.iuc'
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE auth.identities.user_id = auth.users.id
  );
