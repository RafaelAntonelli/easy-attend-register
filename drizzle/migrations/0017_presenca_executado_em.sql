ALTER TABLE public.presencas ADD COLUMN IF NOT EXISTS executado_em timestamptz;
UPDATE public.presencas SET executado_em = created_at WHERE executado_em IS NULL;
ALTER TABLE public.presencas ALTER COLUMN executado_em SET DEFAULT now();
COMMENT ON COLUMN public.presencas.executado_em IS 'Instante (UTC) em que a ação foi feita no aparelho; usado para resolver conflitos da fila offline (a ação mais recente prevalece).';

CREATE OR REPLACE FUNCTION public.presencas_definir_executado_em()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.executado_em IS NULL
     OR (TG_OP = 'UPDATE' AND NEW.executado_em IS NOT DISTINCT FROM OLD.executado_em) THEN
    NEW.executado_em := now();
  END IF;
  -- Nunca aceita um instante no futuro (relógio do aparelho adiantado).
  IF NEW.executado_em > now() + interval '5 minutes' THEN
    NEW.executado_em := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS presencas_executado_em ON public.presencas;
CREATE TRIGGER presencas_executado_em
BEFORE INSERT OR UPDATE ON public.presencas
FOR EACH ROW EXECUTE FUNCTION public.presencas_definir_executado_em();