CREATE OR REPLACE FUNCTION public.calc_faixa_etaria(_nascimento date, _idade integer)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN COALESCE(
      CASE WHEN _nascimento IS NOT NULL THEN date_part('year', age(CURRENT_DATE, _nascimento))::int ELSE NULL END,
      _idade
    ) IS NULL THEN NULL
    WHEN COALESCE(
      CASE WHEN _nascimento IS NOT NULL THEN date_part('year', age(CURRENT_DATE, _nascimento))::int ELSE NULL END,
      _idade
    ) < 12 THEN 'Criança'
    WHEN COALESCE(
      CASE WHEN _nascimento IS NOT NULL THEN date_part('year', age(CURRENT_DATE, _nascimento))::int ELSE NULL END,
      _idade
    ) < 18 THEN 'Adolescente'
    WHEN COALESCE(
      CASE WHEN _nascimento IS NOT NULL THEN date_part('year', age(CURRENT_DATE, _nascimento))::int ELSE NULL END,
      _idade
    ) >= 60 THEN 'Idoso'
    ELSE 'Adulto'
  END;
$function$;

UPDATE public.alunos
SET faixa_etaria = public.calc_faixa_etaria(data_nascimento, idade)
WHERE faixa_etaria IS DISTINCT FROM public.calc_faixa_etaria(data_nascimento, idade);