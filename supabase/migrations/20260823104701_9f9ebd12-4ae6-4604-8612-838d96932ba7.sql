
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weekly_email_opt_in boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.user_ai_keys (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google',
  api_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_ai_keys TO authenticated;
GRANT ALL ON public.user_ai_keys TO service_role;
ALTER TABLE public.user_ai_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their own AI key" ON public.user_ai_keys;
CREATE POLICY "Users manage their own AI key" ON public.user_ai_keys
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND NOT public.is_guest(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND NOT public.is_guest(auth.uid()));

CREATE TABLE IF NOT EXISTS public.weekly_digest_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
GRANT SELECT ON public.weekly_digest_log TO authenticated;
GRANT ALL ON public.weekly_digest_log TO service_role;
ALTER TABLE public.weekly_digest_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read their own digest log" ON public.weekly_digest_log;
CREATE POLICY "Users read their own digest log" ON public.weekly_digest_log
  FOR SELECT TO authenticated USING (user_id = auth.uid());
