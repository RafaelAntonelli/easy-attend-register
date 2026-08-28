CREATE OR REPLACE FUNCTION public.check_aluno_duplicado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nome text := lower(btrim(COALESCE(NEW.nome, '')));
  v_existente text;
BEGIN
  -- CPF NÃO é critério de duplicidade: famílias usam o CPF do responsável para vários alunos.
  IF TG_OP = 'UPDATE'
     AND lower(btrim(COALESCE(OLD.nome,''))) = v_nome
     AND OLD.data_nascimento IS NOT DISTINCT FROM NEW.data_nascimento THEN
    RETURN NEW;
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
$function$;