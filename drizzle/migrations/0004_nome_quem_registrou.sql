ALTER TABLE public.matriculas ADD COLUMN registrado_por_nome text;
ALTER TABLE public.presencas ADD COLUMN registrado_por_nome text;
ALTER TABLE public.alunos ADD COLUMN inativado_por_nome text;

UPDATE public.matriculas m SET registrado_por_nome = COALESCE(NULLIF(p.nome,''), p.email) FROM public.profiles p WHERE p.id = m.registrado_por;
UPDATE public.presencas m SET registrado_por_nome = COALESCE(NULLIF(p.nome,''), p.email) FROM public.profiles p WHERE p.id = m.registrado_por;
UPDATE public.alunos m SET inativado_por_nome = COALESCE(NULLIF(p.nome,''), p.email) FROM public.profiles p WHERE p.id = m.inativado_por;

CREATE OR REPLACE FUNCTION public.preencher_nome_registro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_nome text;
BEGIN
  IF TG_TABLE_NAME = 'alunos' THEN v_id := NEW.inativado_por; ELSE v_id := NEW.registrado_por; END IF;
  IF v_id IS NULL THEN
    IF TG_TABLE_NAME = 'alunos' AND NEW.ativo THEN NEW.inativado_por_nome := NULL; END IF;
    RETURN NEW;
  END IF;
  SELECT COALESCE(NULLIF(nome,''), email) INTO v_nome FROM public.profiles WHERE id = v_id;
  IF v_nome IS NOT NULL THEN
    IF TG_TABLE_NAME = 'alunos' THEN NEW.inativado_por_nome := v_nome; ELSE NEW.registrado_por_nome := v_nome; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER matriculas_nome_registro BEFORE INSERT OR UPDATE OF registrado_por ON public.matriculas FOR EACH ROW EXECUTE FUNCTION public.preencher_nome_registro();
CREATE TRIGGER presencas_nome_registro BEFORE INSERT OR UPDATE OF registrado_por ON public.presencas FOR EACH ROW EXECUTE FUNCTION public.preencher_nome_registro();
CREATE TRIGGER alunos_nome_registro BEFORE INSERT OR UPDATE OF inativado_por, ativo ON public.alunos FOR EACH ROW EXECUTE FUNCTION public.preencher_nome_registro();