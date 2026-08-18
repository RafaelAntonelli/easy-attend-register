ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS pcd_condicoes text[] NOT NULL DEFAULT '{}'::text[];