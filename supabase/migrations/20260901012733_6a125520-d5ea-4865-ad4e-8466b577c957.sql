ALTER TABLE public.backup_cron
  ADD COLUMN IF NOT EXISTS dia_semana int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS hora int NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS minuto int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ultimo_status text;

CREATE OR REPLACE FUNCTION public.agendar_backup(_dia int, _hora int, _minuto int, _ativo boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_cron text;
BEGIN
  IF _dia < 0 OR _dia > 6 OR _hora < 0 OR _hora > 23 OR _minuto < 0 OR _minuto > 59 THEN
    RAISE EXCEPTION 'Agendamento inválido';
  END IF;

  UPDATE public.backup_cron
     SET dia_semana = _dia, hora = _hora, minuto = _minuto, ativo = _ativo
   WHERE id;

  PERFORM cron.unschedule('backup-semanal-arena')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'backup-semanal-arena');

  IF _ativo THEN
    -- horário informado em Brasília (UTC-3) convertido para UTC
    v_cron := _minuto::text || ' ' || (((_hora + 3) % 24))::text || ' * * ' || _dia::text;
    PERFORM cron.schedule('backup-semanal-arena', v_cron, 'SELECT public.disparar_backup_semanal();');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.agendar_backup(int, int, int, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.agendar_backup(int, int, int, boolean) TO service_role;