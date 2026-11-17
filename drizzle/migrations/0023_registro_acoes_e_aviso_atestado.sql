CREATE TABLE public.registro_acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  autor_id uuid,
  autor_nome text,
  acao text NOT NULL,
  detalhe text
);
GRANT SELECT ON public.registro_acoes TO authenticated;
GRANT ALL ON public.registro_acoes TO service_role;
ALTER TABLE public.registro_acoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY registro_acoes_admin_select ON public.registro_acoes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX registro_acoes_created_idx ON public.registro_acoes (created_at DESC);

CREATE OR REPLACE FUNCTION public.registrar_acao_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_autor uuid := auth.uid(); v_nome text; v_alvo text;
BEGIN
  SELECT coalesce(nome, email) INTO v_nome FROM profiles WHERE id = v_autor;
  IF TG_TABLE_NAME = 'alunos' THEN
    INSERT INTO registro_acoes (autor_id, autor_nome, acao, detalhe)
    VALUES (v_autor, v_nome, 'Aluno excluído', OLD.nome || coalesce(' (' || OLD.codigo || ')', ''));
    RETURN OLD;
  ELSIF TG_TABLE_NAME = 'user_roles' THEN
    IF TG_OP = 'DELETE' THEN
      SELECT coalesce(nome, email) INTO v_alvo FROM profiles WHERE id = OLD.user_id;
      INSERT INTO registro_acoes (autor_id, autor_nome, acao, detalhe)
      VALUES (v_autor, v_nome, 'Papel removido', coalesce(v_alvo, 'conta') || ' deixou de ser ' || OLD.role::text);
      RETURN OLD;
    ELSE
      SELECT coalesce(nome, email) INTO v_alvo FROM profiles WHERE id = NEW.user_id;
      INSERT INTO registro_acoes (autor_id, autor_nome, acao, detalhe)
      VALUES (v_autor, v_nome, 'Papel concedido', coalesce(v_alvo, 'conta') || ' agora é ' || NEW.role::text);
      RETURN NEW;
    END IF;
  END IF;
  RETURN NULL;
END $$;
REVOKE EXECUTE ON FUNCTION public.registrar_acao_trigger() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER registrar_exclusao_aluno AFTER DELETE ON public.alunos
  FOR EACH ROW EXECUTE FUNCTION public.registrar_acao_trigger();
CREATE TRIGGER registrar_papeis AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.registrar_acao_trigger();

CREATE OR REPLACE FUNCTION public.reservar_push_lembretes()
RETURNS TABLE(aluno_id uuid, titulo text, mensagem text)
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE avisos_alunos av SET push_enviado_em = now()
  WHERE av.tipo IN ('aula', 'atestado') AND av.push_enviado_em IS NULL AND av.created_at > now() - interval '20 minutes'
  RETURNING av.aluno_id, av.titulo, av.mensagem
$$;

CREATE OR REPLACE FUNCTION public.disparar_avisos_atestado()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
DECLARE v_token text; v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  INSERT INTO avisos_alunos (aluno_id, titulo, mensagem, tipo, chave)
  SELECT a.id,
    'Seu atestado médico está perto de vencer',
    CASE WHEN d.dias = 1 THEN 'Seu atestado vence amanhã' ELSE 'Seu atestado vence em ' || d.dias || ' dias' END
      || ' (' || to_char(a.atestado_data + interval '1 year', 'DD/MM/YYYY') || '). Leve um novo atestado à administração para continuar nas aulas.',
    'atestado',
    'atestado:' || a.id || ':' || (a.atestado_data + interval '1 year')::date || ':' || d.dias
  FROM alunos a CROSS JOIN (VALUES (7), (1)) AS d(dias)
  WHERE a.ativo AND a.atestado_entregue AND a.atestado_data IS NOT NULL
    AND (a.atestado_data + interval '1 year')::date = v_hoje + d.dias
  ON CONFLICT (chave) DO NOTHING;

  SELECT token INTO v_token FROM lembretes_cron WHERE id;
  IF v_token IS NOT NULL AND EXISTS (
    SELECT 1 FROM avisos_alunos av
    WHERE av.tipo = 'atestado' AND av.push_enviado_em IS NULL AND av.created_at > now() - interval '20 minutes'
      AND EXISTS (SELECT 1 FROM push_alunos p WHERE p.aluno_id = av.aluno_id)
  ) THEN
    PERFORM net.http_post(
      url := 'https://project--7a8e031b-b6b5-47c9-8a73-4f9ae3539406.lovable.app/api/public/lembretes-aulas',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-lembretes-secret', v_token),
      body := '{}'::jsonb
    );
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.disparar_avisos_atestado() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('avisos-atestado-arena', '0 12 * * *', 'SELECT public.disparar_avisos_atestado();');