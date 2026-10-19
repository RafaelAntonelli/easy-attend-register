CREATE OR REPLACE FUNCTION public.preencher_nome_registro() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_nome text;
BEGIN
 IF TG_TABLE_NAME = 'alunos' THEN v_id := NEW.inativado_por; ELSE v_id := NEW.registrado_por; END IF;
 IF v_id IS NULL THEN
  IF TG_TABLE_NAME = 'alunos' THEN
   IF NEW.ativo THEN NEW.inativado_por_nome := NULL; END IF;
  END IF;
  RETURN NEW;
 END IF;
 SELECT COALESCE(NULLIF(nome,''),email) INTO v_nome FROM public.profiles WHERE id=v_id;
 IF v_nome IS NOT NULL THEN
  IF TG_TABLE_NAME='alunos' THEN NEW.inativado_por_nome:=v_nome; ELSE NEW.registrado_por_nome:=v_nome; END IF;
 END IF;
 RETURN NEW;
END $$;