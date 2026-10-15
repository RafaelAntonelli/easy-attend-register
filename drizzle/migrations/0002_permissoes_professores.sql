CREATE TABLE public.permissoes_professor (
  chave text PRIMARY KEY,
  ativo boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes_professor TO authenticated;
GRANT ALL ON public.permissoes_professor TO service_role;
ALTER TABLE public.permissoes_professor ENABLE ROW LEVEL SECURITY;
CREATE POLICY permissoes_staff_read ON public.permissoes_professor FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY permissoes_admin_write ON public.permissoes_professor FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.professor_turmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, turma_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professor_turmas TO authenticated;
GRANT ALL ON public.professor_turmas TO service_role;
ALTER TABLE public.professor_turmas ENABLE ROW LEVEL SECURITY;
CREATE POLICY professor_turmas_read ON public.professor_turmas FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY professor_turmas_admin ON public.professor_turmas FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.pode(_user_id uuid, _chave text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'admin')
    OR (public.has_role(_user_id,'professor')
        AND COALESCE((SELECT ativo FROM public.permissoes_professor WHERE chave = _chave), true));
$$;

CREATE OR REPLACE FUNCTION public.equipe_acessos()
RETURNS TABLE(id uuid, created_at timestamptz, last_sign_in_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT u.id, u.created_at, u.last_sign_in_at FROM auth.users u
  WHERE public.has_role(auth.uid(),'admin');
$$;
REVOKE ALL ON FUNCTION public.equipe_acessos() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.equipe_acessos() TO authenticated;

-- Alunos
DROP POLICY IF EXISTS alunos_staff_insert ON public.alunos;
DROP POLICY IF EXISTS alunos_staff_update ON public.alunos;
CREATE POLICY alunos_staff_insert ON public.alunos FOR INSERT TO authenticated WITH CHECK (public.pode(auth.uid(),'alunos_cadastrar'));
CREATE POLICY alunos_staff_update ON public.alunos FOR UPDATE TO authenticated USING (public.pode(auth.uid(),'alunos_editar')) WITH CHECK (public.pode(auth.uid(),'alunos_editar'));

-- Matrículas
DROP POLICY IF EXISTS matriculas_staff_all ON public.matriculas;
CREATE POLICY matriculas_staff_read ON public.matriculas FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY matriculas_staff_write ON public.matriculas FOR INSERT TO authenticated WITH CHECK (public.pode(auth.uid(),'alunos_cadastrar') OR public.pode(auth.uid(),'alunos_editar'));
CREATE POLICY matriculas_staff_update ON public.matriculas FOR UPDATE TO authenticated USING (public.pode(auth.uid(),'alunos_editar')) WITH CHECK (public.pode(auth.uid(),'alunos_editar'));
CREATE POLICY matriculas_staff_delete ON public.matriculas FOR DELETE TO authenticated USING (public.pode(auth.uid(),'alunos_editar'));

-- Turmas, horários, grupos
DROP POLICY IF EXISTS turmas_staff_write ON public.turmas;
DROP POLICY IF EXISTS turmas_staff_update ON public.turmas;
CREATE POLICY turmas_staff_write ON public.turmas FOR INSERT TO authenticated WITH CHECK (public.pode(auth.uid(),'turmas_editar'));
CREATE POLICY turmas_staff_update ON public.turmas FOR UPDATE TO authenticated USING (public.pode(auth.uid(),'turmas_editar')) WITH CHECK (public.pode(auth.uid(),'turmas_editar'));
DROP POLICY IF EXISTS horarios_staff_insert ON public.horarios;
DROP POLICY IF EXISTS horarios_staff_update ON public.horarios;
CREATE POLICY horarios_staff_insert ON public.horarios FOR INSERT TO authenticated WITH CHECK (public.pode(auth.uid(),'turmas_editar'));
CREATE POLICY horarios_staff_update ON public.horarios FOR UPDATE TO authenticated USING (public.pode(auth.uid(),'turmas_editar')) WITH CHECK (public.pode(auth.uid(),'turmas_editar'));
DROP POLICY IF EXISTS grupos_dias_staff_insert ON public.grupos_dias;
DROP POLICY IF EXISTS grupos_dias_staff_update ON public.grupos_dias;
CREATE POLICY grupos_dias_staff_insert ON public.grupos_dias FOR INSERT TO authenticated WITH CHECK (public.pode(auth.uid(),'turmas_editar'));
CREATE POLICY grupos_dias_staff_update ON public.grupos_dias FOR UPDATE TO authenticated USING (public.pode(auth.uid(),'turmas_editar')) WITH CHECK (public.pode(auth.uid(),'turmas_editar'));

-- Presenças
DROP POLICY IF EXISTS presencas_staff_all ON public.presencas;
CREATE POLICY presencas_staff_read ON public.presencas FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY presencas_staff_insert ON public.presencas FOR INSERT TO authenticated WITH CHECK (public.pode(auth.uid(),'presenca_registrar'));
CREATE POLICY presencas_staff_update ON public.presencas FOR UPDATE TO authenticated USING (public.pode(auth.uid(),'presenca_registrar')) WITH CHECK (public.pode(auth.uid(),'presenca_registrar'));
CREATE POLICY presencas_staff_delete ON public.presencas FOR DELETE TO authenticated USING (public.pode(auth.uid(),'presenca_registrar'));

-- Licenças
DROP POLICY IF EXISTS licencas_staff_insert ON public.licencas_medicas;
DROP POLICY IF EXISTS licencas_staff_update ON public.licencas_medicas;
CREATE POLICY licencas_staff_insert ON public.licencas_medicas FOR INSERT TO authenticated WITH CHECK (public.pode(auth.uid(),'licencas_gerenciar'));
CREATE POLICY licencas_staff_update ON public.licencas_medicas FOR UPDATE TO authenticated USING (public.pode(auth.uid(),'licencas_gerenciar')) WITH CHECK (public.pode(auth.uid(),'licencas_gerenciar'));

-- Fila
DROP POLICY IF EXISTS fila_espera_staff_all ON public.fila_espera;
CREATE POLICY fila_espera_staff_read ON public.fila_espera FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY fila_espera_staff_insert ON public.fila_espera FOR INSERT TO authenticated WITH CHECK (public.pode(auth.uid(),'fila_gerenciar'));
CREATE POLICY fila_espera_staff_update ON public.fila_espera FOR UPDATE TO authenticated USING (public.pode(auth.uid(),'fila_gerenciar')) WITH CHECK (public.pode(auth.uid(),'fila_gerenciar'));
CREATE POLICY fila_espera_staff_delete ON public.fila_espera FOR DELETE TO authenticated USING (public.pode(auth.uid(),'fila_gerenciar'));

-- Configurações
DROP POLICY IF EXISTS configuracoes_staff_write ON public.configuracoes;
DROP POLICY IF EXISTS configuracoes_staff_update ON public.configuracoes;
CREATE POLICY configuracoes_staff_write ON public.configuracoes FOR INSERT TO authenticated WITH CHECK (public.pode(auth.uid(),'configuracoes_editar'));
CREATE POLICY configuracoes_staff_update ON public.configuracoes FOR UPDATE TO authenticated USING (public.pode(auth.uid(),'configuracoes_editar')) WITH CHECK (public.pode(auth.uid(),'configuracoes_editar'));