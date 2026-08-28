ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id bigint,
  ADD COLUMN IF NOT EXISTS telegram_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_link_code text;

UPDATE public.profiles SET telegram_link_code = upper(substr(md5(random()::text || id::text), 1, 8)) WHERE telegram_link_code IS NULL;

ALTER TABLE public.profiles ALTER COLUMN telegram_link_code SET DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_telegram_link_code_key ON public.profiles (telegram_link_code);