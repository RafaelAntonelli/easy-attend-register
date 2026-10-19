ALTER TABLE public.aparelhos_alunos
  ADD COLUMN IF NOT EXISTS aluno_solicitado_id uuid REFERENCES public.alunos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS solicitado_em timestamptz;
CREATE INDEX IF NOT EXISTS aparelhos_alunos_pendentes_idx ON public.aparelhos_alunos (solicitado_em DESC) WHERE aprovado_em IS NULL AND aluno_solicitado_id IS NOT NULL;