REVOKE EXECUTE ON FUNCTION public.check_aluno_duplicado() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM authenticated, anon, public;