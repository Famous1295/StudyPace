ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS aisensy_chat_id text,
  ADD COLUMN IF NOT EXISTS aisensy_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aisensy_link_code text;

UPDATE public.profiles SET aisensy_link_code = upper(substr(md5(random()::text || id::text), 1, 8)) WHERE aisensy_link_code IS NULL;

ALTER TABLE public.profiles ALTER COLUMN aisensy_link_code SET DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_aisensy_link_code_key ON public.profiles (aisensy_link_code);

ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS aisensy_api_key text,
  ADD COLUMN IF NOT EXISTS aisensy_campaign_name text;