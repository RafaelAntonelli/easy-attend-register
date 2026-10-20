ALTER TABLE public.avisos_alunos ADD COLUMN IF NOT EXISTS push_enviado_em timestamptz;
CREATE INDEX IF NOT EXISTS avisos_alunos_lembretes_pendentes_idx ON public.avisos_alunos (created_at) WHERE tipo = 'aula' AND push_enviado_em IS NULL;

CREATE TABLE public.lembretes_cron (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  token text NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  ultima_execucao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.lembretes_cron TO service_role;
ALTER TABLE public.lembretes_cron ENABLE ROW LEVEL SECURITY;

-- Minutos de antecedência (30 ou 15) cujo lembrete é devido neste momento, ou NULL.
-- Janela de 5 minutos tolera execuções atrasadas; a chave única evita repetição.
CREATE OR REPLACE FUNCTION public.lembrete_aula_devido(_horario text, _dias text[], _agora timestamp)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT n FROM (VALUES (30), (15)) m(n)
  WHERE _horario ~ '^\s*[0-9]{1,2}:[0-9]{2}'
    AND EXISTS (
      SELECT 1 FROM unnest(_dias) d
      WHERE left(translate(lower(trim(d)), 'áàâãéêíóôõúç', 'aaaaeeiooouc'), 3)
        = (ARRAY['dom','seg','ter','qua','qui','sex','sab'])[extract(dow FROM _agora)::int + 1]
    )
    AND _agora >= _agora::date + substring(_horario FROM '^\s*([0-9]{1,2}:[0-9]{2})')::time - make_interval(mins => n)
    AND _agora <  _agora::date + substring(_horario FROM '^\s*([0-9]{1,2}:[0-9]{2})')::time - make_interval(mins => n) + interval '5 minutes'
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.lembrete_aula_devido(text, text[], timestamp) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lembrete_aula_devido(text, text[], timestamp) TO service_role;

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
    AND EXISTS (SELECT 1 FROM acessos_alunos v WHERE v.aluno_id = a.id AND v.ativo)
    AND NOT EXISTS (
      SELECT 1 FROM licencas_medicas l
      WHERE l.aluno_id = a.id AND l.encerrada_em IS NULL
        AND l.data_inicio <= agora::date AND agora::date < l.data_retorno
    )
  ON CONFLICT (chave) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.gerar_lembretes_aulas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gerar_lembretes_aulas() TO service_role;

-- Marca os lembretes recentes ainda não notificados e devolve-os para envio (uma única vez).
CREATE OR REPLACE FUNCTION public.reservar_push_lembretes()
RETURNS TABLE (aluno_id uuid, titulo text, mensagem text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE avisos_alunos av SET push_enviado_em = now()
  WHERE av.tipo = 'aula' AND av.push_enviado_em IS NULL AND av.created_at > now() - interval '20 minutes'
  RETURNING av.aluno_id, av.titulo, av.mensagem
$$;
REVOKE ALL ON FUNCTION public.reservar_push_lembretes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_push_lembretes() TO service_role;

-- Executada a cada minuto: cria os lembretes no banco e chama o app só quando há celular para notificar.
CREATE OR REPLACE FUNCTION public.disparar_lembretes_aulas() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_token text;
BEGIN
  PERFORM public.gerar_lembretes_aulas();
  INSERT INTO public.lembretes_cron (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
  UPDATE public.lembretes_cron SET ultima_execucao = now() WHERE id RETURNING token INTO v_token;
  IF EXISTS (
    SELECT 1 FROM public.avisos_alunos av
    WHERE av.tipo = 'aula' AND av.push_enviado_em IS NULL AND av.created_at > now() - interval '20 minutes'
      AND EXISTS (SELECT 1 FROM public.push_alunos p WHERE p.aluno_id = av.aluno_id)
  ) THEN
    PERFORM net.http_post(
      url := 'https://project--7a8e031b-b6b5-47c9-8a73-4f9ae3539406.lovable.app/api/public/lembretes-aulas',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-lembretes-secret', v_token),
      body := '{}'::jsonb
    );
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.disparar_lembretes_aulas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.disparar_lembretes_aulas() TO service_role;