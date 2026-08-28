CREATE TABLE public.code_snippets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  subject_id UUID,
  title TEXT NOT NULL,
  language TEXT NOT NULL,
  code TEXT NOT NULL DEFAULT '',
  stdin TEXT NOT NULL DEFAULT '',
  last_output TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.code_snippets TO authenticated;
GRANT ALL ON public.code_snippets TO service_role;
ALTER TABLE public.code_snippets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own snippets" ON public.code_snippets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_code_snippets_user ON public.code_snippets(user_id, updated_at DESC);
CREATE TRIGGER update_code_snippets_updated_at BEFORE UPDATE ON public.code_snippets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();