CREATE TABLE public.licencas_medicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  data_retorno date NOT NULL,
  motivo text,
  registrado_por uuid DEFAULT auth.uid(),
  registrado_por_nome text,
  encerrada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX licencas_medicas_aluno_idx ON public.licencas_medicas(aluno_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.licencas_medicas TO authenticated;
GRANT ALL ON public.licencas_medicas TO service_role;
ALTER TABLE public.licencas_medicas ENABLE ROW LEVEL SECURITY;
CREATE POLICY licencas_staff_read ON public.licencas_medicas FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY licencas_staff_insert ON public.licencas_medicas FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY licencas_staff_update ON public.licencas_medicas FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY licencas_admin_delete ON public.licencas_medicas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));