CREATE TABLE public.aparelhos_alunos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token_hash text NOT NULL UNIQUE, codigo text NOT NULL UNIQUE, aluno_id uuid REFERENCES public.alunos(id) ON DELETE CASCADE, aprovado_por uuid, aprovado_em timestamptz, expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'), created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.aparelhos_alunos TO service_role;
ALTER TABLE public.aparelhos_alunos ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.portal_limites (chave text PRIMARY KEY, tentativas integer NOT NULL DEFAULT 0, janela timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.portal_limites TO service_role;
ALTER TABLE public.portal_limites ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.consumir_limite_portal(_chave text, _max integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE n integer; BEGIN INSERT INTO public.portal_limites(chave,tentativas) VALUES(_chave,1) ON CONFLICT(chave) DO UPDATE SET tentativas=CASE WHEN portal_limites.janela < now()-interval '15 minutes' THEN 1 ELSE portal_limites.tentativas+1 END, janela=CASE WHEN portal_limites.janela < now()-interval '15 minutes' THEN now() ELSE portal_limites.janela END RETURNING tentativas INTO n; RETURN n <= _max; END $$;
REVOKE ALL ON FUNCTION public.consumir_limite_portal(text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consumir_limite_portal(text,integer) TO service_role;