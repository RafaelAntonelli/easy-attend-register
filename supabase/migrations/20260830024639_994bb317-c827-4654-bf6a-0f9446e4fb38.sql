-- Faixa etária (ECA) e turno calculados no banco
ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS faixa_etaria text;
ALTER TABLE public.turmas ADD COLUMN IF NOT EXISTS turno text;

CREATE OR REPLACE FUNCTION public.calc_faixa_etaria(_nascimento date, _idade integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(
      CASE WHEN _nascimento IS NOT NULL
        THEN date_part('year', age(CURRENT_DATE, _nascimento))::int
        ELSE NULL END,
      _idade
    ) IS NULL THEN NULL
    WHEN COALESCE(
      CASE WHEN _nascimento IS NOT NULL
        THEN date_part('year', age(CURRENT_DATE, _nascimento))::int
        ELSE NULL END,
      _idade
    ) < 12 THEN 'Criança'
    WHEN COALESCE(
      CASE WHEN _nascimento IS NOT NULL
        THEN date_part('year', age(CURRENT_DATE, _nascimento))::int
        ELSE NULL END,
      _idade
    ) < 18 THEN 'Adolescente'
    ELSE 'Adulto'
  END;
$$;

CREATE OR REPLACE FUNCTION public.calc_turno(_horario text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE h int;
BEGIN
  IF _horario IS NULL THEN RETURN NULL; END IF;
  h := NULLIF((regexp_match(_horario, '(\d{1,2})'))[1], '')::int;
  IF h IS NULL THEN RETURN NULL; END IF;
  IF h < 12 THEN RETURN 'Matutino'; END IF;
  IF h < 18 THEN RETURN 'Vespertino'; END IF;
  RETURN 'Noturno';
END;
$$;

CREATE OR REPLACE FUNCTION public.set_faixa_etaria()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.faixa_etaria := public.calc_faixa_etaria(NEW.data_nascimento, NEW.idade);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_turno_turma()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.turno := public.calc_turno(NEW.horario);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alunos_set_faixa_etaria ON public.alunos;
CREATE TRIGGER alunos_set_faixa_etaria
BEFORE INSERT OR UPDATE ON public.alunos
FOR EACH ROW EXECUTE FUNCTION public.set_faixa_etaria();

DROP TRIGGER IF EXISTS turmas_set_turno ON public.turmas;
CREATE TRIGGER turmas_set_turno
BEFORE INSERT OR UPDATE ON public.turmas
FOR EACH ROW EXECUTE FUNCTION public.set_turno_turma();

UPDATE public.alunos SET faixa_etaria = public.calc_faixa_etaria(data_nascimento, idade);
UPDATE public.turmas SET turno = public.calc_turno(horario);

-- Configurações do sistema
CREATE TABLE IF NOT EXISTS public.configuracoes (
  chave text PRIMARY KEY,
  valor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes TO authenticated;
GRANT ALL ON public.configuracoes TO service_role;

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "configuracoes_staff_read" ON public.configuracoes
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "configuracoes_staff_write" ON public.configuracoes
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "configuracoes_staff_update" ON public.configuracoes
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP TRIGGER IF EXISTS configuracoes_updated_at ON public.configuracoes;
CREATE TRIGGER configuracoes_updated_at
BEFORE UPDATE ON public.configuracoes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.configuracoes (chave, valor) VALUES ('atestado_aviso_dias', '30')
ON CONFLICT (chave) DO NOTHING;