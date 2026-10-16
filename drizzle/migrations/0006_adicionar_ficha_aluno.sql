ALTER TABLE public.alunos ADD COLUMN IF NOT EXISTS doc_ficha_path text;
COMMENT ON COLUMN public.alunos.doc_ficha_path IS 'Caminho do arquivo da ficha do aluno no armazenamento de documentos.';