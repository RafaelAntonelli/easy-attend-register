
-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'professor');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id);
$$;

CREATE POLICY "user_roles_select_own" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_roles_admin_select" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "user_roles_admin_manage" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- Existing users become admins
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
ON CONFLICT DO NOTHING;

-- 2. Lock down data tables to staff
DROP POLICY IF EXISTS alunos_all ON public.alunos;
CREATE POLICY alunos_staff_read ON public.alunos FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY alunos_staff_insert ON public.alunos FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY alunos_staff_update ON public.alunos FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY alunos_admin_delete ON public.alunos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS matriculas_all ON public.matriculas;
CREATE POLICY matriculas_staff_all ON public.matriculas FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS presencas_all ON public.presencas;
CREATE POLICY presencas_staff_all ON public.presencas FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS fila_espera_all ON public.fila_espera;
CREATE POLICY fila_espera_staff_all ON public.fila_espera FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS turmas_all ON public.turmas;
CREATE POLICY turmas_staff_read ON public.turmas FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY turmas_staff_write ON public.turmas FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY turmas_staff_update ON public.turmas FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY turmas_admin_delete ON public.turmas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. Profiles: only own profile or admin
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 4. Storage: fotos-alunos only for staff
DROP POLICY IF EXISTS "fotos_alunos_all" ON storage.objects;
CREATE POLICY "fotos_alunos_staff_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fotos-alunos' AND public.is_staff(auth.uid()));
CREATE POLICY "fotos_alunos_staff_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fotos-alunos' AND public.is_staff(auth.uid()));
CREATE POLICY "fotos_alunos_staff_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'fotos-alunos' AND public.is_staff(auth.uid()));
CREATE POLICY "fotos_alunos_staff_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fotos-alunos' AND public.has_role(auth.uid(), 'admin'));
