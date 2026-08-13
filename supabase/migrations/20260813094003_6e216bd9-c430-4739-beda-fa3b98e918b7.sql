ALTER TABLE public.matriculas
  ADD COLUMN IF NOT EXISTS modalidade text NOT NULL DEFAULT 'Natação';