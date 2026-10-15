CREATE TABLE public.backup_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  origem text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'sucesso',
  resumo text,
  planilha_nome text,
  planilha_id text,
  pasta_planilhas text,
  enviados integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  falhas jsonb NOT NULL DEFAULT '[]'::jsonb,
  executado_por uuid,
  executado_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.backup_historico TO authenticated;
GRANT ALL ON public.backup_historico TO service_role;
ALTER TABLE public.backup_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY backup_historico_admin_read ON public.backup_historico FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX backup_historico_iniciado_idx ON public.backup_historico (iniciado_em DESC);