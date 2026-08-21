CREATE TABLE public.grupos_dias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label text NOT NULL UNIQUE,
  dias text[] NOT NULL DEFAULT '{}'::text[],
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grupos_dias TO authenticated;
GRANT ALL ON public.grupos_dias TO service_role;

ALTER TABLE public.grupos_dias ENABLE ROW LEVEL SECURITY;

CREATE POLICY grupos_dias_staff_read ON public.grupos_dias FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY grupos_dias_staff_insert ON public.grupos_dias FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()));
CREATE POLICY grupos_dias_staff_update ON public.grupos_dias FOR UPDATE TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY grupos_dias_admin_delete ON public.grupos_dias FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.grupos_dias (label, dias, ordem) VALUES
  ('Terça e Quinta', ARRAY['Ter','Qui'], 1),
  ('Quarta e Sexta', ARRAY['Qua','Sex'], 2);