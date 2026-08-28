DO $$
DECLARE r RECORD; base text; candidate text; i int;
BEGIN
  FOR r IN SELECT id, email FROM public.profiles WHERE username IS NULL OR btrim(username) = '' LOOP
    base := regexp_replace(lower(split_part(coalesce(r.email, 'user'), '@', 1)), '[^a-z0-9_]', '', 'g');
    IF length(base) < 3 THEN base := base || 'user'; END IF;
    base := left(base, 18);
    candidate := base;
    i := 0;
    WHILE EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.username) = candidate) LOOP
      i := i + 1;
      candidate := left(base, 18 - length(i::text)) || i::text;
    END LOOP;
    UPDATE public.profiles SET username = candidate WHERE id = r.id;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_username(_user_id uuid, _username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE _clean text := lower(btrim(_username));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  IF _clean !~ '^[a-z0-9_]{3,20}$' THEN
    RAISE EXCEPTION 'Username must be 3-20 characters: letters, numbers or underscore';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = _clean AND id <> _user_id) THEN
    RAISE EXCEPTION 'That username is already taken';
  END IF;
  UPDATE public.profiles SET username = _clean WHERE id = _user_id;
  RETURN _clean;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_username(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_username(uuid, text) TO authenticated;