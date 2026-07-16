-- Oprava bootstrapu na Supabase Cloud – pgcrypto běží ve schématu extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION internal_create_auth_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role user_role
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, extensions
AS $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_email TEXT := lower(trim(p_email));
BEGIN
  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'Neplatný e-mail';
  END IF;

  IF length(p_password) < 8 THEN
    RAISE EXCEPTION 'Heslo musí mít alespoň 8 znaků';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'Uživatel s tímto e-mailem již existuje';
  END IF;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '',
    '',
    '',
    '',
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', p_full_name, 'role', p_role::text),
    now(),
    now()
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email),
    'email',
    v_user_id::text,
    now(),
    now(),
    now()
  );

  UPDATE public.profiles
  SET role = p_role, full_name = p_full_name, email = v_email, updated_at = now()
  WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION internal_create_auth_user(TEXT, TEXT, TEXT, user_role) FROM PUBLIC;
