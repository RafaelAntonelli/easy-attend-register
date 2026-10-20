ALTER TABLE public.acessos_alunos ADD COLUMN IF NOT EXISTS lembretes_aula boolean NOT NULL DEFAULT true;

-- Preferência do aluno e se a conferência automática está ligada pela administração.
CREATE OR REPLACE FUNCTION public.lembretes_portal() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'ativo', v.lembretes_aula,
    'agendados', COALESCE((SELECT j.active FROM cron.job j WHERE j.jobname = 'lembretes-aulas-arena'), false)
  )
  FROM public.acessos_alunos v WHERE v.user_id = auth.uid() AND v.ativo
$$;
REVOKE ALL ON FUNCTION public.lembretes_portal() FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.lembretes_portal() TO authenticated;

CREATE OR REPLACE FUNCTION public.definir_lembretes_portal(_ativo boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.acessos_alunos SET lembretes_aula = _ativo WHERE user_id = auth.uid() AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Acesso indisponível' USING ERRCODE = '42501'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.definir_lembretes_portal(boolean) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.definir_lembretes_portal(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.gerar_lembretes_aulas() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE agora timestamp := now() AT TIME ZONE 'America/Sao_Paulo';
BEGIN
  INSERT INTO avisos_alunos (aluno_id, titulo, mensagem, tipo, chave)
  SELECT DISTINCT ON (a.id, t.id)
    a.id, 'Lembrete de aula',
    'Sua aula de ' || t.modalidade || ' começa às ' || substring(t.horario FROM '^\s*([0-9]{1,2}:[0-9]{2})') || '. Faltam ' || x.n || ' minutos.',
    'aula',
    a.id::text || ':' || t.id::text || ':' || agora::date::text || ':' || x.n::text
  FROM alunos a
  JOIN matriculas m ON m.aluno_id = a.id AND m.status = 'ativa'
  JOIN turmas t ON t.id = m.turma_id AND t.ativa
  CROSS JOIN LATERAL (SELECT public.lembrete_aula_devido(t.horario, t.dias_semana, agora) AS n) x
  WHERE x.n IS NOT NULL
    AND a.ativo
    AND EXISTS (SELECT 1 FROM acessos_alunos v WHERE v.aluno_id = a.id AND v.ativo AND v.lembretes_aula)
    AND NOT EXISTS (
      SELECT 1 FROM licencas_medicas l
      WHERE l.aluno_id = a.id AND l.encerrada_em IS NULL
        AND l.data_inicio <= agora::date AND agora::date < l.data_retorno
    )
  ON CONFLICT (chave) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.gerar_lembretes_aulas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_lembretes_aulas() TO service_role;