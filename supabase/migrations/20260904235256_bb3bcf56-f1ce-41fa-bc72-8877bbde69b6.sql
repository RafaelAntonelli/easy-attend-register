CREATE TABLE public.anotacoes_alunos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  texto text NOT NULL,
  autor_id uuid REFERENCES auth.users(id),
  autor_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.anotacoes_alunos TO authenticated;
GRANT ALL ON public.anotacoes_alunos TO service_role;

ALTER TABLE public.anotacoes_alunos ENABLE ROW LEVEL SECURITY;

CREATE POLICY anotacoes_staff_read ON public.anotacoes_alunos FOR SELECT TO authenticated USING (is_staff(auth.uid()));
CREATE POLICY anotacoes_staff_insert ON public.anotacoes_alunos FOR INSERT TO authenticated WITH CHECK (is_staff(auth.uid()) AND autor_id = auth.uid());
CREATE POLICY anotacoes_autor_update ON public.anotacoes_alunos FOR UPDATE TO authenticated USING (autor_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY anotacoes_autor_delete ON public.anotacoes_alunos FOR DELETE TO authenticated USING (autor_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX anotacoes_alunos_aluno_idx ON public.anotacoes_alunos(aluno_id);

CREATE TRIGGER update_anotacoes_alunos_updated_at BEFORE UPDATE ON public.anotacoes_alunos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();