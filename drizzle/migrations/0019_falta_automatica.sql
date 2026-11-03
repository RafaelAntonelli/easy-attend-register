-- Falta automática: alunos sem registro 15 minutos após o início da aula recebem falta.
CREATE TABLE public.configuracao_falta_automatica (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  ativo boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por_nome text
);
GRANT SELECT ON public.configuracao_falta_automatica TO authenticated;
GRANT ALL ON public.configuracao_falta_automatica TO service_role;
ALTER TABLE public.configuracao_falta_automatica ENABLE ROW LEVEL SECURITY;
CREATE POLICY falta_automatica_staff_read ON public.configuracao_falta_automatica
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
INSERT INTO public.configuracao_falta_automatica (id, ativo) VALUES (true, false) ON CONFLICT (id) DO NOTHING;

-- Verdadeiro quando a turma tem aula hoje e já passaram 15 minutos do início, até o fim da aula
-- (ou 1 hora após o início quando o horário não informa o fim).
CREATE OR REPLACE FUNCTION public.falta_automatica_devida(_horario text, _dias text[], _agora timestamp)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v_inicio time; v_fim time; v_limite time;
BEGIN
  IF _horario IS NULL OR _horario !~ '^\s*([01]?[0-9]|2[0-3]):[0-5][0-9]' THEN RETURN false; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM unnest(_dias) d
    WHERE left(translate(lower(trim(d)), 'áàâãéêíóôõúç', 'aaaaeeiooouc'), 3)
      = (ARRAY['dom','seg','ter','qua','qui','sex','sab'])[extract(dow FROM _agora)::int + 1]
  ) THEN RETURN false; END IF;
  v_inicio := substring(_horario FROM '^\s*([0-9]{1,2}:[0-9]{2})')::time;
  BEGIN
    v_fim := substring(_horario FROM '^\s*[0-9]{1,2}:[0-9]{2}\D+([0-9]{1,2}:[0-9]{2})')::time;
  EXCEPTION WHEN others THEN v_fim := NULL;
  END;
  IF v_inicio > time '22:30' THEN RETURN false; END IF;
  v_limite := CASE WHEN v_fim IS NOT NULL AND v_fim > v_inicio + interval '15 minutes' THEN v_fim ELSE v_inicio + interval '1 hour' END;
  RETURN _agora >= _agora::date + v_inicio + interval '15 minutes'
     AND _agora <  _agora::date + v_limite;
END $$;
REVOKE ALL ON FUNCTION public.falta_automatica_devida(text, text[], timestamp) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.falta_automatica_devida(text, text[], timestamp) TO service_role;

-- Marca falta para alunos ativos, matriculados, sem licença médica em vigor e sem nenhum registro no dia.
-- O instante de execução fica no começo do dia, para que qualquer marcação da equipe
-- (inclusive feita offline) substitua a falta automática.
CREATE OR REPLACE FUNCTION public.marcar_faltas_automaticas() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  agora timestamp := now() AT TIME ZONE 'America/Sao_Paulo';
  hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  n integer := 0;
BEGIN
  IF NOT COALESCE((SELECT ativo FROM public.configuracao_falta_automatica WHERE id), false) THEN
    RETURN 0;
  END IF;
  INSERT INTO public.presencas (aluno_id, turma_id, data, horario, metodo, status, observacoes, registrado_por_nome, executado_em)
  SELECT DISTINCT ON (a.id)
    a.id, t.id, hoje, now(), 'automatico', 'falta',
    'Falta automática: sem presença 15 min após o início da aula',
    'Falta automática',
    (hoje::timestamp AT TIME ZONE 'America/Sao_Paulo')
  FROM public.turmas t
  JOIN public.matriculas m ON m.turma_id = t.id AND m.status = 'ativa' AND m.data_inicio <= hoje
  JOIN public.alunos a ON a.id = m.aluno_id AND a.ativo
  WHERE t.ativa
    AND public.falta_automatica_devida(t.horario, t.dias_semana, agora)
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
REVOKE ALL ON FUNCTION public.marcar_faltas_automaticas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.marcar_faltas_automaticas() TO service_role;

-- Agenda a verificação só nos minutos em que alguma turma completa 15 min de aula
-- (horário de Brasília, UTC-3, convertido para UTC). Sem verificação contínua.
CREATE OR REPLACE FUNCTION public.sincronizar_falta_automatica() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE r record;
BEGIN
  PERFORM cron.unschedule(j.jobname) FROM cron.job j WHERE j.jobname LIKE 'falta-automatica-%';
  IF NOT COALESCE((SELECT ativo FROM public.configuracao_falta_automatica WHERE id), false) THEN
    RETURN;
  END IF;
  FOR r IN
    SELECT extract(minute FROM x.t)::int AS minuto,
           string_agg(DISTINCT ((extract(hour FROM x.t)::int + 3) % 24)::text, ',') AS horas
    FROM (
      SELECT substring(horario FROM '^\s*([0-9]{1,2}:[0-9]{2})')::time + interval '15 minutes' AS t
      FROM public.turmas
      WHERE ativa AND horario ~ '^\s*([01]?[0-9]|2[0-3]):[0-5][0-9]'
    ) x
    GROUP BY 1
  LOOP
    PERFORM cron.schedule('falta-automatica-' || lpad(r.minuto::text, 2, '0'),
      format('%s %s * * *', r.minuto, r.horas),
      'SELECT public.marcar_faltas_automaticas();');
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.sincronizar_falta_automatica() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sincronizar_falta_automatica() TO service_role;

CREATE OR REPLACE FUNCTION public.turmas_sincronizar_falta_automatica() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.sincronizar_falta_automatica();
  RETURN NULL;
END $$;
CREATE TRIGGER turmas_falta_automatica
  AFTER INSERT OR DELETE OR UPDATE OF horario, ativa ON public.turmas
  FOR EACH STATEMENT EXECUTE FUNCTION public.turmas_sincronizar_falta_automatica();

-- Só administradores ligam ou desligam.
CREATE OR REPLACE FUNCTION public.definir_falta_automatica(_ativo boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem alterar a falta automática.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.configuracao_falta_automatica (id, ativo, atualizado_em, atualizado_por_nome)
  VALUES (true, _ativo, now(), public.nome_autor_atual())
  ON CONFLICT (id) DO UPDATE SET ativo = EXCLUDED.ativo, atualizado_em = now(), atualizado_por_nome = EXCLUDED.atualizado_por_nome;
  PERFORM public.sincronizar_falta_automatica();
END $$;
REVOKE ALL ON FUNCTION public.definir_falta_automatica(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_falta_automatica(boolean) TO authenticated;