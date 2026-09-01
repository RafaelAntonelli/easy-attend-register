CREATE TABLE public.backup_cron (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  token text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  ultimo_backup timestamptz,
  ultimo_resultado text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.backup_cron TO service_role;

ALTER TABLE public.backup_cron ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER backup_cron_updated_at
  BEFORE UPDATE ON public.backup_cron
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.backup_cron (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.disparar_backup_semanal()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_token text;
BEGIN
  SELECT token INTO v_token FROM public.backup_cron WHERE id;
  PERFORM net.http_post(
    url := 'https://project--7a8e031b-b6b5-47c9-8a73-4f9ae3539406.lovable.app/api/public/backup-semanal',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-backup-secret', v_token),
    body := '{}'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.disparar_backup_semanal() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule(
  'backup-semanal-arena',
  '0 6 * * 1',
  $$SELECT public.disparar_backup_semanal();$$
);