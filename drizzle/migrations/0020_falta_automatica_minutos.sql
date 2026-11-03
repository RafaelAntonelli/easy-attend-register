ALTER TABLE public.configuracao_falta_automatica
  ADD COLUMN IF NOT EXISTS minutos integer NOT NULL DEFAULT 15 CHECK (minutos BETWEEN 5 AND 60);

-- Verdadeiro quando a turma tem aula hoje e já passaram _minutos do início, até o fim da aula
-- (ou 45 minutos depois desse prazo quando o horário não informa o fim).
CREATE OR REPLACE FUNCTION public.falta_automatica_devida(_horario text, _dias text[], _agora timestamp, _minutos integer)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v_inicio time; v_fim time; v_prazo interval := make_interval(mins => _minutos); v_limite interval;
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
  -- Sem virar o dia.
  IF v_inicio::interval + v_prazo + interval '45 minutes' >= interval '24 hours' THEN RETURN false; END IF;
  v_limite := CASE WHEN v_fim IS NOT NULL AND v_fim::interval > v_inicio::interval + v_prazo
                   THEN v_fim::interval ELSE v_inicio::interval + v_prazo + interval '45 minutes' END;
  RETURN _agora >= _agora::date + v_inicio + v_prazo
     AND _agora <  _agora::date + v_limite;
END $$;
REVOKE ALL ON FUNCTION public.falta_automatica_devida(text, text[], timestamp, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.falta_automatica_devida(text, text[], timestamp, integer) TO service_role;
COMMENT ON FUNCTION public.falta_automatica_devida(text, text[], timestamp) IS 'DEPRECATED: replaced by falta_automatica_devida(text, text[], timestamp, integer)';

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

CREATE OR REPLACE FUNCTION public.sincronizar_falta_automatica() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE r record; v_ativo boolean; v_min integer;
BEGIN
  PERFORM cron.unschedule(j.jobname) FROM cron.job j WHERE j.jobname LIKE 'falta-automatica-%';
  SELECT ativo, minutos INTO v_ativo, v_min FROM public.configuracao_falta_automatica WHERE id;
  IF NOT COALESCE(v_ativo, false) THEN RETURN; END IF;
  v_min := COALESCE(v_min, 15);
  FOR r IN
    SELECT extract(minute FROM x.t)::int AS minuto,
           string_agg(DISTINCT ((extract(hour FROM x.t)::int + 3) % 24)::text, ',') AS horas
    FROM (
      SELECT substring(horario FROM '^\s*([0-9]{1,2}:[0-9]{2})')::time + make_interval(mins => v_min) AS t
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

-- Só administradores mudam o prazo.
CREATE OR REPLACE FUNCTION public.definir_minutos_falta_automatica(_minutos integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Somente administradores podem alterar a falta automática.' USING ERRCODE = '42501';
  END IF;
  IF _minutos IS NULL OR _minutos < 5 OR _minutos > 60 THEN
    RAISE EXCEPTION 'Escolha entre 5 e 60 minutos.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.configuracao_falta_automatica (id, minutos, atualizado_em, atualizado_por_nome)
  VALUES (true, _minutos, now(), public.nome_autor_atual())
  ON CONFLICT (id) DO UPDATE SET minutos = EXCLUDED.minutos, atualizado_em = now(), atualizado_por_nome = EXCLUDED.atualizado_por_nome;
  PERFORM public.sincronizar_falta_automatica();
END $$;
REVOKE ALL ON FUNCTION public.definir_minutos_falta_automatica(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_minutos_falta_automatica(integer) TO authenticated;