ALTER TABLE public.alunos
  ADD COLUMN motivo_inativacao text,
  ADD COLUMN inativado_em timestamptz,
  ADD COLUMN inativado_por uuid REFERENCES auth.users(id);