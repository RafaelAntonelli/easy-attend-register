ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS atestado_entregue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS atestado_data date,
  ADD COLUMN IF NOT EXISTS telefone2 text,
  ADD COLUMN IF NOT EXISTS rede_ensino text,
  ADD COLUMN IF NOT EXISTS escola text,
  ADD COLUMN IF NOT EXISTS idade integer;