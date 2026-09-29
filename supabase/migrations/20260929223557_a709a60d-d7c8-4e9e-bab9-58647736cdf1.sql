CREATE OR REPLACE FUNCTION public.gerar_codigo_matricula()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  codigo_gerado text;
BEGIN
  LOOP
    codigo_gerado := substr(alfabeto, 1 + floor(random() * 24)::integer, 1)
      || substr(alfabeto, 1 + floor(random() * 24)::integer, 1)
      || substr(alfabeto, 25 + floor(random() * 8)::integer, 1);

    FOR indice IN 1..4 LOOP
      codigo_gerado := codigo_gerado || substr(alfabeto, 1 + floor(random() * 32)::integer, 1);
    END LOOP;

    codigo_gerado := (
      SELECT string_agg(letra, '' ORDER BY random())
      FROM regexp_split_to_table(codigo_gerado, '') AS letra
    );

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.alunos WHERE codigo = codigo_gerado
    );
  END LOOP;

  RETURN codigo_gerado;
END;
$$;

UPDATE public.alunos
SET codigo = public.gerar_codigo_matricula()
WHERE codigo IS NULL OR codigo !~ '^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{7}$';

ALTER TABLE public.alunos
  ALTER COLUMN codigo SET DEFAULT public.gerar_codigo_matricula();

ALTER TABLE public.alunos
  ADD CONSTRAINT alunos_codigo_sete_alfanumerico_check
  CHECK (codigo ~ '^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{7}$');