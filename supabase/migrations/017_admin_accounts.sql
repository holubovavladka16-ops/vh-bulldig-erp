-- Modul 13 – Administrátorské účty a první spuštění
-- Spusťte po 016_module12_vyplatni_pasky.sql
-- Hesla se ukládají šifrovaně v auth.users (bcrypt). Nikdy neukládejte hesla do zdrojového kódu.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- První uživatel = administrátor
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE role = 'administrator' AND is_active = true
  ) THEN
    v_role := 'administrator';
  ELSE
    v_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'delnik');
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)),
    v_role
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Synchronizace e-mailu profilu po změně v auth
CREATE OR REPLACE FUNCTION sync_profile_email_from_auth()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles
    SET email = NEW.email, updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_profile_email_from_auth();

-- Blokace veřejné registrace po vytvoření prvního administrátora
CREATE OR REPLACE FUNCTION guard_auth_user_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE role = 'administrator' AND is_active = true
  ) AND get_user_role() IS DISTINCT FROM 'administrator' THEN
    RAISE EXCEPTION 'Vytváření účtů je povoleno pouze administrátorovi systému.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS guard_auth_user_insert_trigger ON auth.users;
CREATE TRIGGER guard_auth_user_insert_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION guard_auth_user_insert();

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

CREATE OR REPLACE FUNCTION system_needs_bootstrap()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM profiles WHERE role = 'administrator' AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION bootstrap_first_admin(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, extensions
AS $$
DECLARE
  v_full_name TEXT := COALESCE(NULLIF(TRIM(p_full_name), ''), split_part(lower(trim(p_email)), '@', 1));
  v_user_id UUID;
BEGIN
  IF NOT system_needs_bootstrap() THEN
    RAISE EXCEPTION 'Administrátor již existuje';
  END IF;

  v_user_id := internal_create_auth_user(p_email, p_password, v_full_name, 'administrator');
  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_create_user(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_role user_role DEFAULT 'administrator'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, extensions
AS $$
DECLARE
  v_full_name TEXT := COALESCE(NULLIF(TRIM(p_full_name), ''), split_part(lower(trim(p_email)), '@', 1));
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Přístup pouze pro administrátora';
  END IF;

  IF p_role NOT IN ('administrator', 'vedouci', 'delnik') THEN
    RAISE EXCEPTION 'Neplatná role';
  END IF;

  RETURN internal_create_auth_user(p_email, p_password, v_full_name, p_role);
END;
$$;

CREATE OR REPLACE FUNCTION admin_set_user_active(p_user_id UUID, p_is_active BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, extensions
AS $$
DECLARE
  v_role user_role;
  v_admin_count INTEGER;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Přístup pouze pro administrátora';
  END IF;

  IF p_user_id = auth.uid() AND NOT p_is_active THEN
    RAISE EXCEPTION 'Nelze deaktivovat vlastní účet';
  END IF;

  SELECT role INTO v_role FROM profiles WHERE id = p_user_id;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Uživatel nenalezen';
  END IF;

  IF NOT p_is_active AND v_role = 'administrator' THEN
    SELECT count(*) INTO v_admin_count
    FROM profiles
    WHERE role = 'administrator' AND is_active = true AND id <> p_user_id;

    IF v_admin_count = 0 THEN
      RAISE EXCEPTION 'Musí zůstat alespoň jeden aktivní administrátor';
    END IF;
  END IF;

  UPDATE profiles SET is_active = p_is_active, updated_at = now() WHERE id = p_user_id;

  IF p_is_active THEN
    UPDATE auth.users SET banned_until = NULL WHERE id = p_user_id;
  ELSE
    UPDATE auth.users SET banned_until = 'infinity'::timestamptz WHERE id = p_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION admin_revoke_administrator(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_count INTEGER;
BEGIN
  IF get_user_role() <> 'administrator' THEN
    RAISE EXCEPTION 'Přístup pouze pro administrátora';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Nelze odebrat administrátorská práva sám sobě';
  END IF;

  SELECT count(*) INTO v_admin_count
  FROM profiles
  WHERE role = 'administrator' AND is_active = true AND id <> p_user_id;

  IF v_admin_count = 0 THEN
    RAISE EXCEPTION 'Musí zůstat alespoň jeden aktivní administrátor';
  END IF;

  UPDATE profiles SET role = 'delnik', updated_at = now() WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION system_needs_bootstrap() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION bootstrap_first_admin(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_create_user(TEXT, TEXT, TEXT, user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_user_active(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_revoke_administrator(UUID) TO authenticated;
