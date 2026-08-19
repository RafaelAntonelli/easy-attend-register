
DROP POLICY IF EXISTS "fotos_alunos_auth_select" ON storage.objects;
DROP POLICY IF EXISTS "fotos_alunos_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "fotos_alunos_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "fotos_alunos_auth_delete" ON storage.objects;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin'::public.app_role, 'professor'::public.app_role)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;
