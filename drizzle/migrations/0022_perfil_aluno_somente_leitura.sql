CREATE OR REPLACE FUNCTION public.perfil_portal_aluno() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT jsonb_build_object(
 'nome',a.nome,'codigo',a.codigo,'data_nascimento',a.data_nascimento,'telefone',a.telefone,'telefone2',a.telefone2,'email',a.email,
 'responsavel',a.responsavel,'rg',a.rg,'cpf',a.cpf,'pcd',a.pcd,'pcd_condicoes',COALESCE(to_jsonb(a.pcd_condicoes),'[]'::jsonb),'pcd_descricao',a.pcd_descricao,
 'sexo',a.sexo,'faixa_etaria',a.faixa_etaria,'escola',a.escola,'rede_ensino',a.rede_ensino,'ativo',a.ativo,'cadastrado_em',a.created_at,
 'atestado_entregue',a.atestado_entregue,'atestado_data',a.atestado_data)
FROM public.alunos a JOIN public.acessos_alunos v ON v.aluno_id=a.id WHERE v.user_id=auth.uid() AND v.ativo $$;
REVOKE ALL ON FUNCTION public.perfil_portal_aluno() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.perfil_portal_aluno() TO authenticated;
-- O aluno não altera mais nenhum dado do cadastro pela área do aluno.
DROP FUNCTION IF EXISTS public.editar_contato_portal(text,text,text);