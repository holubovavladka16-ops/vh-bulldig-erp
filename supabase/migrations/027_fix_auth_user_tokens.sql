-- Oprava GoTrue HTTP 500: token sloupce v auth.users nesmí být NULL
UPDATE auth.users SET confirmation_token = '' WHERE confirmation_token IS NULL;
UPDATE auth.users SET recovery_token = '' WHERE recovery_token IS NULL;
UPDATE auth.users SET email_change_token_new = '' WHERE email_change_token_new IS NULL;
UPDATE auth.users SET email_change = '' WHERE email_change IS NULL;

UPDATE auth.identities
SET provider_id = user_id::text
WHERE provider = 'email'
  AND provider_id IS DISTINCT FROM user_id::text;
