ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS sexo text,
  ADD COLUMN IF NOT EXISTS doc_atestado_path text,
  ADD COLUMN IF NOT EXISTS doc_residencia_path text,
  ADD COLUMN IF NOT EXISTS doc_matricula_path text,
  ADD COLUMN IF NOT EXISTS doc_identidade_path text;

ALTER TABLE public.fila_espera
  ADD COLUMN IF NOT EXISTS idade integer,
  ADD COLUMN IF NOT EXISTS pcd boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pcd_condicoes text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS pcd_descricao text;