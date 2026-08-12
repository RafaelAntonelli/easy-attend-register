ALTER TABLE public.turmas ALTER COLUMN capacidade SET DEFAULT 40;
UPDATE public.turmas SET capacidade = 40;

ALTER TABLE public.alunos
  ADD COLUMN IF NOT EXISTS pcd boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pcd_descricao text,
  ADD COLUMN IF NOT EXISTS foto_path text;

ALTER TABLE public.presencas
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'presente';

ALTER TABLE public.presencas DROP CONSTRAINT IF EXISTS presencas_status_check;
ALTER TABLE public.presencas ADD CONSTRAINT presencas_status_check CHECK (status IN ('presente','falta','falta_justificada'));

DROP POLICY IF EXISTS "fotos_alunos_auth_select" ON storage.objects;
CREATE POLICY "fotos_alunos_auth_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'fotos-alunos');

DROP POLICY IF EXISTS "fotos_alunos_auth_insert" ON storage.objects;
CREATE POLICY "fotos_alunos_auth_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'fotos-alunos');

DROP POLICY IF EXISTS "fotos_alunos_auth_update" ON storage.objects;
CREATE POLICY "fotos_alunos_auth_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'fotos-alunos') WITH CHECK (bucket_id = 'fotos-alunos');

DROP POLICY IF EXISTS "fotos_alunos_auth_delete" ON storage.objects;
CREATE POLICY "fotos_alunos_auth_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'fotos-alunos');