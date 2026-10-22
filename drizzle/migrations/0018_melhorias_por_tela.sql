-- Nome de quem está fazendo a alteração (equipe, próprio aluno ou sistema).
CREATE OR REPLACE FUNCTION public.nome_autor_atual() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 'Sistema'
    WHEN EXISTS (SELECT 1 FROM public.acessos_alunos v WHERE v.user_id = auth.uid()) THEN 'O próprio aluno (área do aluno)'
    ELSE COALESCE((SELECT COALESCE(NULLIF(p.nome, ''), p.email) FROM public.profiles p WHERE p.id = auth.uid()), 'Usuário')
  END
$$;
REVOKE ALL ON FUNCTION public.nome_autor_atual() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nome_autor_atual() TO service_role;

-- 1) Histórico de alterações na ficha do aluno
CREATE TABLE public.historico_alunos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  acao text NOT NULL,
  alteracoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  autor_id uuid,
  autor_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX historico_alunos_aluno_idx ON public.historico_alunos (aluno_id, created_at DESC);
GRANT SELECT ON public.historico_alunos TO authenticated;
GRANT ALL ON public.historico_alunos TO service_role;
ALTER TABLE public.historico_alunos ENABLE ROW LEVEL SECURITY;
CREATE POLICY historico_alunos_staff_read ON public.historico_alunos FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.registrar_historico_aluno() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old jsonb; v_new jsonb; v_alt jsonb := '[]'::jsonb; k text; v_acao text := 'alteracao';
  ignorar text[] := ARRAY['id','created_at','idade','faixa_etaria','inativado_por','inativado_por_nome','inativado_em','codigo'];
  arquivos text[] := ARRAY['foto_path','doc_atestado_path','doc_residencia_path','doc_matricula_path','doc_identidade_path','doc_ficha_path'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.historico_alunos (aluno_id, acao, autor_id, autor_nome)
    VALUES (NEW.id, 'cadastro', auth.uid(), public.nome_autor_atual());
    RETURN NEW;
  END IF;
  v_old := to_jsonb(OLD); v_new := to_jsonb(NEW);
  FOR k IN SELECT jsonb_object_keys(v_new) LOOP
    CONTINUE WHEN k = ANY(ignorar);
    IF (v_old -> k) IS DISTINCT FROM (v_new -> k) THEN
      IF k = ANY(arquivos) THEN
        v_alt := v_alt || jsonb_build_array(jsonb_build_object('campo', k,
          'antes', CASE WHEN v_old ->> k IS NULL THEN NULL ELSE to_jsonb('arquivo anterior'::text) END,
          'depois', CASE WHEN v_new ->> k IS NULL THEN to_jsonb('removido'::text) ELSE to_jsonb('novo arquivo'::text) END));
      ELSE
        v_alt := v_alt || jsonb_build_array(jsonb_build_object('campo', k, 'antes', v_old -> k, 'depois', v_new -> k));
      END IF;
    END IF;
  END LOOP;
  IF jsonb_array_length(v_alt) = 0 THEN RETURN NEW; END IF;
  IF OLD.ativo IS DISTINCT FROM NEW.ativo THEN
    v_acao := CASE WHEN NEW.ativo THEN 'reativacao' ELSE 'inativacao' END;
  END IF;
  INSERT INTO public.historico_alunos (aluno_id, acao, alteracoes, autor_id, autor_nome)
  VALUES (NEW.id, v_acao, v_alt, auth.uid(), public.nome_autor_atual());
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.registrar_historico_aluno() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER alunos_historico AFTER INSERT OR UPDATE ON public.alunos
  FOR EACH ROW EXECUTE FUNCTION public.registrar_historico_aluno();

CREATE OR REPLACE FUNCTION public.registrar_historico_matricula() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_antes text; v_depois text; v_alt jsonb := '[]'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT nome INTO v_depois FROM public.turmas WHERE id = NEW.turma_id;
    INSERT INTO public.historico_alunos (aluno_id, acao, alteracoes, autor_id, autor_nome)
    VALUES (NEW.aluno_id, 'matricula', jsonb_build_array(jsonb_build_object('campo','turma','antes',NULL,'depois',v_depois)), auth.uid(), public.nome_autor_atual());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.alunos WHERE id = OLD.aluno_id) THEN
      SELECT nome INTO v_antes FROM public.turmas WHERE id = OLD.turma_id;
      INSERT INTO public.historico_alunos (aluno_id, acao, alteracoes, autor_id, autor_nome)
      VALUES (OLD.aluno_id, 'matricula', jsonb_build_array(jsonb_build_object('campo','turma','antes',v_antes,'depois',NULL)), auth.uid(), public.nome_autor_atual());
    END IF;
    RETURN OLD;
  END IF;
  IF OLD.turma_id IS DISTINCT FROM NEW.turma_id THEN
    SELECT nome INTO v_antes FROM public.turmas WHERE id = OLD.turma_id;
    SELECT nome INTO v_depois FROM public.turmas WHERE id = NEW.turma_id;
    v_alt := v_alt || jsonb_build_array(jsonb_build_object('campo','turma','antes',v_antes,'depois',v_depois));
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_alt := v_alt || jsonb_build_array(jsonb_build_object('campo','status_matricula','antes',OLD.status,'depois',NEW.status));
  END IF;
  IF jsonb_array_length(v_alt) > 0 THEN
    INSERT INTO public.historico_alunos (aluno_id, acao, alteracoes, autor_id, autor_nome)
    VALUES (NEW.aluno_id, 'matricula', v_alt, auth.uid(), public.nome_autor_atual());
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.registrar_historico_matricula() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER matriculas_historico AFTER INSERT OR UPDATE OR DELETE ON public.matriculas
  FOR EACH ROW EXECUTE FUNCTION public.registrar_historico_matricula();

-- 2) Anotação da aula (uma por turma e dia)
CREATE TABLE public.anotacoes_aula (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  data date NOT NULL,
  texto text NOT NULL CHECK (char_length(texto) BETWEEN 1 AND 1000),
  autor_id uuid,
  autor_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (turma_id, data)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anotacoes_aula TO authenticated;
GRANT ALL ON public.anotacoes_aula TO service_role;
ALTER TABLE public.anotacoes_aula ENABLE ROW LEVEL SECURITY;
CREATE POLICY anotacoes_aula_staff_read ON public.anotacoes_aula FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY anotacoes_aula_insert ON public.anotacoes_aula FOR INSERT TO authenticated WITH CHECK (public.pode(auth.uid(), 'presenca_registrar'));
CREATE POLICY anotacoes_aula_update ON public.anotacoes_aula FOR UPDATE TO authenticated USING (public.pode(auth.uid(), 'presenca_registrar')) WITH CHECK (public.pode(auth.uid(), 'presenca_registrar'));
CREATE POLICY anotacoes_aula_delete ON public.anotacoes_aula FOR DELETE TO authenticated USING (public.pode(auth.uid(), 'presenca_registrar'));

CREATE OR REPLACE FUNCTION public.preencher_autor_anotacao_aula() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.autor_id := auth.uid();
  NEW.autor_nome := public.nome_autor_atual();
  NEW.updated_at := now();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.preencher_autor_anotacao_aula() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER anotacoes_aula_autor BEFORE INSERT OR UPDATE ON public.anotacoes_aula
  FOR EACH ROW EXECUTE FUNCTION public.preencher_autor_anotacao_aula();

-- 3) Meu perfil da equipe: telefone e foto
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telefone text CHECK (telefone IS NULL OR char_length(telefone) <= 20);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS foto_path text;

-- 4) Avisos: envio agrupado, destino, turma e agendamento
ALTER TABLE public.avisos_alunos ADD COLUMN IF NOT EXISTS envio_id uuid;
ALTER TABLE public.avisos_alunos ADD COLUMN IF NOT EXISTS destino text CHECK (destino IS NULL OR destino IN ('aluno','turma','todos'));
ALTER TABLE public.avisos_alunos ADD COLUMN IF NOT EXISTS turma_id uuid REFERENCES public.turmas(id) ON DELETE SET NULL;
ALTER TABLE public.avisos_alunos ADD COLUMN IF NOT EXISTS agendado_para timestamptz;

UPDATE public.avisos_alunos a SET envio_id = g.envio, destino = CASE WHEN g.qtd > 1 THEN 'todos' ELSE 'aluno' END
FROM (
  SELECT autor_id, titulo, mensagem, date_trunc('second', created_at) AS seg, count(*) AS qtd, gen_random_uuid() AS envio
  FROM public.avisos_alunos WHERE tipo = 'equipe' AND envio_id IS NULL
  GROUP BY autor_id, titulo, mensagem, date_trunc('second', created_at)
) g
WHERE a.tipo = 'equipe' AND a.envio_id IS NULL AND a.autor_id IS NOT DISTINCT FROM g.autor_id
  AND a.titulo = g.titulo AND a.mensagem = g.mensagem AND date_trunc('second', a.created_at) = g.seg;

CREATE INDEX IF NOT EXISTS avisos_alunos_envio_idx ON public.avisos_alunos (envio_id) WHERE envio_id IS NOT NULL;

-- Aluno só vê o aviso agendado depois do horário marcado.
DROP POLICY IF EXISTS avisos_proprio_select ON public.avisos_alunos;
CREATE POLICY avisos_proprio_select ON public.avisos_alunos FOR SELECT TO authenticated USING (
  (agendado_para IS NULL OR agendado_para <= now())
  AND EXISTS (SELECT 1 FROM public.acessos_alunos v WHERE v.user_id = auth.uid() AND v.ativo AND v.aluno_id = avisos_alunos.aluno_id)
);
CREATE OR REPLACE FUNCTION public.marcar_aviso_lido(_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE avisos_alunos SET lido_em = now()
  WHERE id = _id AND lido_em IS NULL AND (agendado_para IS NULL OR agendado_para <= now())
    AND aluno_id IN (SELECT aluno_id FROM acessos_alunos WHERE user_id = auth.uid() AND ativo)
$$;

-- Resumo dos envios para a administração (quantos receberam e quantos leram).
CREATE OR REPLACE FUNCTION public.envios_avisos(_limite integer DEFAULT 50)
RETURNS TABLE (envio_id uuid, titulo text, mensagem text, criado_em timestamptz, agendado_para timestamptz, destino text, turma text, autor text, total bigint, lidos bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.envio_id, min(a.titulo), min(a.mensagem), min(a.created_at), min(a.agendado_para), min(a.destino),
         min(t.nome), min(COALESCE(NULLIF(p.nome, ''), p.email)), count(*), count(a.lido_em)
  FROM public.avisos_alunos a
  LEFT JOIN public.turmas t ON t.id = a.turma_id
  LEFT JOIN public.profiles p ON p.id = a.autor_id
  WHERE a.envio_id IS NOT NULL AND public.has_role(auth.uid(), 'admin')
  GROUP BY a.envio_id
  ORDER BY min(a.created_at) DESC
  LIMIT LEAST(GREATEST(_limite, 1), 200)
$$;
REVOKE ALL ON FUNCTION public.envios_avisos(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.envios_avisos(integer) TO authenticated;

-- Avisos agendados: um disparo único marcado para o minuto exato de cada envio (sem conferência periódica).
CREATE OR REPLACE FUNCTION public.reservar_push_aviso_agendado(_envio uuid)
RETURNS TABLE (aluno_id uuid, titulo text, mensagem text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE avisos_alunos av SET push_enviado_em = now()
  WHERE av.envio_id = _envio AND av.agendado_para IS NOT NULL AND av.push_enviado_em IS NULL AND av.agendado_para <= now()
  RETURNING av.aluno_id, av.titulo, av.mensagem
$$;
REVOKE ALL ON FUNCTION public.reservar_push_aviso_agendado(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_push_aviso_agendado(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.disparar_aviso_agendado(_envio uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_token text;
BEGIN
  BEGIN PERFORM cron.unschedule('aviso-' || _envio::text); EXCEPTION WHEN OTHERS THEN NULL; END;
  -- Quem não ativou notificações já recebe pela central de avisos; marca como entregue.
  UPDATE public.avisos_alunos av SET push_enviado_em = now()
  WHERE av.envio_id = _envio AND av.push_enviado_em IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.push_alunos p WHERE p.aluno_id = av.aluno_id);
  IF NOT EXISTS (SELECT 1 FROM public.avisos_alunos av WHERE av.envio_id = _envio AND av.push_enviado_em IS NULL) THEN RETURN; END IF;
  INSERT INTO public.lembretes_cron (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
  SELECT token INTO v_token FROM public.lembretes_cron WHERE id;
  PERFORM net.http_post(
    url := 'https://project--7a8e031b-b6b5-47c9-8a73-4f9ae3539406.lovable.app/api/public/avisos-agendados',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-lembretes-secret', v_token),
    body := jsonb_build_object('envio', _envio)
  );
END $$;
REVOKE ALL ON FUNCTION public.disparar_aviso_agendado(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.disparar_aviso_agendado(uuid) TO service_role;

-- Marca o disparo único (horário em UTC) ou cancela um aviso agendado.
CREATE OR REPLACE FUNCTION public.agendar_disparo_aviso(_envio uuid, _quando timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE t timestamp := _quando AT TIME ZONE 'UTC';
BEGIN
  PERFORM cron.schedule('aviso-' || _envio::text,
    format('%s %s %s %s *', extract(minute FROM t)::int, extract(hour FROM t)::int, extract(day FROM t)::int, extract(month FROM t)::int),
    format('SELECT public.disparar_aviso_agendado(%L::uuid);', _envio));
END $$;
REVOKE ALL ON FUNCTION public.agendar_disparo_aviso(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agendar_disparo_aviso(uuid, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.cancelar_disparo_aviso(_envio uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  BEGIN PERFORM cron.unschedule('aviso-' || _envio::text); EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
REVOKE ALL ON FUNCTION public.cancelar_disparo_aviso(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_disparo_aviso(uuid) TO service_role;

-- 5) Frequência do próprio aluno no mês atual
CREATE OR REPLACE FUNCTION public.frequencia_portal_aluno() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aluno uuid; v_inicio date := date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date; r jsonb;
BEGIN
  SELECT aluno_id INTO v_aluno FROM public.acessos_alunos WHERE user_id = auth.uid() AND ativo;
  IF v_aluno IS NULL THEN RAISE EXCEPTION 'Acesso de aluno indisponível' USING ERRCODE = '42501'; END IF;
  SELECT jsonb_build_object(
    'inicio', v_inicio,
    'presencas', count(*) FILTER (WHERE p.status = 'presente'),
    'faltas', count(*) FILTER (WHERE p.status = 'falta'),
    'justificadas', count(*) FILTER (WHERE p.status = 'falta_justificada'),
    'registros', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('data', x.data, 'status', x.status) ORDER BY x.data DESC)
      FROM (SELECT DISTINCT ON (q.data) q.data, q.status FROM public.presencas q
            WHERE q.aluno_id = v_aluno AND q.data >= v_inicio ORDER BY q.data DESC, q.horario DESC) x
    ), '[]'::jsonb)
  ) INTO r
  FROM public.presencas p WHERE p.aluno_id = v_aluno AND p.data >= v_inicio;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.frequencia_portal_aluno() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.frequencia_portal_aluno() TO authenticated;