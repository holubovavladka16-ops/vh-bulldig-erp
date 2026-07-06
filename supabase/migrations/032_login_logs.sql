-- Bezpečnostní log přihlášení + e-mailové upozornění administrátorovi

CREATE TABLE login_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,
  user_name TEXT,
  login_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  device TEXT,
  browser TEXT,
  os TEXT,
  location TEXT,
  user_agent TEXT,
  device_type TEXT NOT NULL DEFAULT 'unknown' CHECK (device_type IN ('mobile', 'desktop', 'unknown')),
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_login_logs_user ON login_logs(user_id);
CREATE INDEX idx_login_logs_time ON login_logs(login_time DESC);

ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin čte login logy"
  ON login_logs FOR SELECT
  USING (get_user_role() = 'administrator');

CREATE POLICY "Service role spravuje login logy"
  ON login_logs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

GRANT SELECT ON login_logs TO authenticated, service_role;
GRANT INSERT, UPDATE ON login_logs TO service_role;

-- Záložní RPC: uloží log, pokud Edge Function není dostupná (bez e-mailu)
CREATE OR REPLACE FUNCTION insert_login_log_fallback(
  p_user_email TEXT,
  p_user_name TEXT,
  p_ip_address TEXT,
  p_device TEXT,
  p_browser TEXT,
  p_os TEXT,
  p_location TEXT,
  p_user_agent TEXT,
  p_device_type TEXT,
  p_email_error TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_log_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Neautorizovaný požadavek';
  END IF;

  INSERT INTO login_logs (
    user_id,
    user_email,
    user_name,
    login_time,
    ip_address,
    device,
    browser,
    os,
    location,
    user_agent,
    device_type,
    email_sent,
    email_error
  ) VALUES (
    v_user_id,
    p_user_email,
    NULLIF(TRIM(p_user_name), ''),
    now(),
    NULLIF(TRIM(p_ip_address), ''),
    NULLIF(TRIM(p_device), ''),
    NULLIF(TRIM(p_browser), ''),
    NULLIF(TRIM(p_os), ''),
    NULLIF(TRIM(p_location), ''),
    NULLIF(TRIM(p_user_agent), ''),
    COALESCE(NULLIF(TRIM(p_device_type), ''), 'unknown'),
    false,
    COALESCE(NULLIF(TRIM(p_email_error), ''), 'E-mail neodeslán – Edge Function nedostupná')
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION insert_login_log_fallback TO authenticated;
