CREATE TABLE public.fila_espera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text,
  modalidade text NOT NULL DEFAULT 'Natação',
  preferencia_horario text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fila_espera TO authenticated;
GRANT ALL ON public.fila_espera TO service_role;
ALTER TABLE public.fila_espera ENABLE ROW LEVEL SECURITY;
CREATE POLICY fila_espera_all ON public.fila_espera FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_fila_espera_updated_at BEFORE UPDATE ON public.fila_espera FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();