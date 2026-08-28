ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS twilio_chat_id text,
  ADD COLUMN IF NOT EXISTS twilio_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS twilio_link_code text;

UPDATE public.profiles SET twilio_link_code = upper(substr(md5(random()::text || id::text), 1, 8)) WHERE twilio_link_code IS NULL;

ALTER TABLE public.profiles ALTER COLUMN twilio_link_code SET DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_twilio_link_code_key ON public.profiles (twilio_link_code);