CREATE TABLE public.horarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  horario text NOT NULL UNIQUE,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.horarios TO authenticated;
GRANT ALL ON public.horarios TO service_role;

ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY horarios_staff_read ON public.horarios FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY horarios_staff_insert ON public.horarios FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY horarios_staff_update ON public.horarios FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY horarios_admin_delete ON public.horarios FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO public.horarios (horario, ordem) VALUES
  ('06:00 às 06:50', 1),
  ('07:00 às 07:50', 2),
  ('08:00 às 08:50', 3),
  ('09:00 às 09:50', 4),
  ('10:00 às 10:50', 5),
  ('11:00 às 11:50', 6),
  ('14:00 às 14:50', 7),
  ('15:00 às 15:50', 8),
  ('16:00 às 16:50', 9),
  ('17:00 às 17:50', 10),
  ('18:00 às 18:50', 11),
  ('19:00 às 19:50', 12);