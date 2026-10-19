CREATE TABLE public.acessos_alunos (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 aluno_id uuid NOT NULL UNIQUE REFERENCES public.alunos(id) ON DELETE CASCADE,
 ativo boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.acessos_alunos TO authenticated;
GRANT ALL ON public.acessos_alunos TO service_role;
ALTER TABLE public.acessos_alunos ENABLE ROW LEVEL SECURITY;
CREATE POLICY acessos_alunos_read ON public.acessos_alunos FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE FUNCTION public.validar_separacao_acesso_aluno() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_TABLE_NAME = 'acessos_alunos' THEN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id) THEN RAISE EXCEPTION 'Conta da equipe não pode ser vinculada como aluno'; END IF;
 ELSE
  IF EXISTS (SELECT 1 FROM public.acessos_alunos WHERE user_id = NEW.user_id) THEN RAISE EXCEPTION 'Conta de aluno não pode receber acesso da equipe'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validar_separacao_acesso_aluno() FROM PUBLIC;
CREATE TRIGGER validar_acesso_aluno BEFORE INSERT OR UPDATE ON public.acessos_alunos FOR EACH ROW EXECUTE FUNCTION public.validar_separacao_acesso_aluno();
CREATE TRIGGER validar_papel_equipe BEFORE INSERT OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.validar_separacao_acesso_aluno();

CREATE FUNCTION public.consultar_portal_aluno() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_aluno uuid; v_resultado jsonb;
BEGIN
 SELECT aluno_id INTO v_aluno FROM public.acessos_alunos WHERE user_id = auth.uid() AND ativo;
 IF v_aluno IS NULL THEN RAISE EXCEPTION 'Acesso de aluno indisponível' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('id',a.id,'nome',a.nome,'codigo',a.codigo,'ativo',a.ativo,'foto_path',a.foto_path,'atestado_entregue',a.atestado_entregue,'atestado_data',a.atestado_data,
 'turmas',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.id,'nome',t.nome,'modalidade',t.modalidade,'dias_semana',t.dias_semana,'horario',t.horario,'professor',t.professor) ORDER BY t.horario,t.nome) FROM public.matriculas m JOIN public.turmas t ON t.id=m.turma_id WHERE m.aluno_id=a.id AND m.status='ativa' AND t.ativa),'[]'::jsonb))
 INTO v_resultado FROM public.alunos a WHERE a.id=v_aluno;
 IF v_resultado IS NULL THEN RAISE EXCEPTION 'Acesso de aluno indisponível' USING ERRCODE='42501'; END IF;
 RETURN v_resultado;
END $$;
REVOKE ALL ON FUNCTION public.consultar_portal_aluno() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consultar_portal_aluno() TO authenticated;

CREATE FUNCTION public.foto_do_proprio_aluno(_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS(SELECT 1 FROM public.acessos_alunos v JOIN public.alunos a ON a.id=v.aluno_id WHERE v.user_id=auth.uid() AND v.ativo AND a.foto_path=_path);
$$;
REVOKE ALL ON FUNCTION public.foto_do_proprio_aluno(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.foto_do_proprio_aluno(text) TO authenticated;
CREATE POLICY foto_portal_aluno ON storage.objects FOR SELECT TO authenticated USING (bucket_id='fotos-alunos' AND public.foto_do_proprio_aluno(name));