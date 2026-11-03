-- Dias sem aula (feriados, recessos, aulas canceladas) para todas as turmas (turma_id nulo) ou uma turma.
CREATE TABLE public.dias_sem_aula (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  turma_id uuid REFERENCES public.turmas(id) ON DELETE CASCADE,
  motivo text NOT NULL DEFAULT '',
  criado_por uuid DEFAULT auth.uid(),
  criado_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX dias_sem_aula_unico ON public.dias_sem_aula (data, COALESCE(turma_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX dias_sem_aula_data_idx ON public.dias_sem_aula (data);

GRANT SELECT, INSERT, DELETE ON public.dias_sem_aula TO authenticated;
GRANT ALL ON public.dias_sem_aula TO service_role;
ALTER TABLE public.dias_sem_aula ENABLE ROW LEVEL SECURITY;
CREATE POLICY dias_sem_aula_staff_read ON public.dias_sem_aula
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY dias_sem_aula_admin_insert ON public.dias_sem_aula
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY dias_sem_aula_admin_delete ON public.dias_sem_aula
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Preenche quem cadastrou e apaga as faltas automáticas já marcadas nesse dia.
CREATE OR REPLACE FUNCTION public.dias_sem_aula_ao_inserir() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND TG_WHEN = 'BEFORE' THEN
    NEW.criado_por := auth.uid();
    NEW.criado_por_nome := public.nome_autor_atual();
    NEW.motivo := left(trim(COALESCE(NEW.motivo, '')), 200);
    RETURN NEW;
  END IF;
  DELETE FROM public.presencas p
  WHERE p.metodo = 'automatico' AND p.status = 'falta' AND p.data = NEW.data
    AND (NEW.turma_id IS NULL OR p.turma_id = NEW.turma_id);
  RETURN NULL;
END $$;
CREATE TRIGGER dias_sem_aula_preencher BEFORE INSERT ON public.dias_sem_aula
  FOR EACH ROW EXECUTE FUNCTION public.dias_sem_aula_ao_inserir();
CREATE TRIGGER dias_sem_aula_limpar_faltas AFTER INSERT ON public.dias_sem_aula
  FOR EACH ROW EXECUTE FUNCTION public.dias_sem_aula_ao_inserir();

-- Falta automática ignora turmas com dia sem aula.
CREATE OR REPLACE FUNCTION public.marcar_faltas_automaticas() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  agora timestamp := now() AT TIME ZONE 'America/Sao_Paulo';
  hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_ativo boolean; v_min integer;
  n integer := 0;
BEGIN
  SELECT ativo, minutos INTO v_ativo, v_min FROM public.configuracao_falta_automatica WHERE id;
  IF NOT COALESCE(v_ativo, false) THEN RETURN 0; END IF;
  v_min := COALESCE(v_min, 15);
  INSERT INTO public.presencas (aluno_id, turma_id, data, horario, metodo, status, observacoes, registrado_por_nome, executado_em)
  SELECT DISTINCT ON (a.id)
    a.id, t.id, hoje, now(), 'automatico', 'falta',
    'Falta automática: sem presença ' || v_min || ' min após o início da aula',
    'Falta automática',
    (hoje::timestamp AT TIME ZONE 'America/Sao_Paulo')
  FROM public.turmas t
  JOIN public.matriculas m ON m.turma_id = t.id AND m.status = 'ativa' AND m.data_inicio <= hoje
  JOIN public.alunos a ON a.id = m.aluno_id AND a.ativo
  WHERE t.ativa
    AND public.falta_automatica_devida(t.horario, t.dias_semana, agora, v_min)
    AND NOT EXISTS (
      SELECT 1 FROM public.dias_sem_aula d
      WHERE d.data = hoje AND (d.turma_id IS NULL OR d.turma_id = t.id)
    )
    AND NOT EXISTS (SELECT 1 FROM public.presencas p WHERE p.aluno_id = a.id AND p.data = hoje)
    AND NOT EXISTS (
      SELECT 1 FROM public.licencas_medicas l
      WHERE l.aluno_id = a.id AND l.encerrada_em IS NULL
        AND l.data_inicio <= hoje AND hoje < l.data_retorno
    )
  ORDER BY a.id, t.horario
  ON CONFLICT (aluno_id, turma_id, data) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;