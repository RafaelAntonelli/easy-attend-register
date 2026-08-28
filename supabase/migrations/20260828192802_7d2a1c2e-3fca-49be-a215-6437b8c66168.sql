CREATE OR REPLACE FUNCTION public.check_aluno_duplicado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpf text := NULLIF(regexp_replace(COALESCE(NEW.cpf, ''), '\D', '', 'g'), '');
  v_nome text := lower(btrim(COALESCE(NEW.nome, '')));
  v_existente text;
BEGIN
  IF v_cpf IS NOT NULL AND length(v_cpf) = 11 THEN
    SELECT a.nome INTO v_existente
    FROM public.alunos a
    WHERE a.id <> NEW.id
      AND regexp_replace(COALESCE(a.cpf, ''), '\D', '', 'g') = v_cpf
    LIMIT 1;
    IF v_existente IS NOT NULL THEN
      RAISE EXCEPTION 'Aluno já cadastrado com este CPF: %', v_existente
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  IF NEW.data_nascimento IS NOT NULL AND v_nome <> '' THEN
    SELECT a.nome INTO v_existente
    FROM public.alunos a
    WHERE a.id <> NEW.id
      AND lower(btrim(a.nome)) = v_nome
      AND a.data_nascimento = NEW.data_nascimento
    LIMIT 1;
    IF v_existente IS NOT NULL THEN
      RAISE EXCEPTION 'Aluno já cadastrado: %', v_existente
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alunos_check_duplicado ON public.alunos;
CREATE TRIGGER alunos_check_duplicado
BEFORE INSERT OR UPDATE OF nome, cpf, data_nascimento ON public.alunos
FOR EACH ROW EXECUTE FUNCTION public.check_aluno_duplicado();