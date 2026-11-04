import { queryOptions } from "@tanstack/react-query";
import { consultarPortalAluno } from "@/lib/portal-aluno.functions";
import { tokenAparelhoLocal } from "@/lib/aparelho-local";

/** Dados da área do aluno (turmas, foto, atestado), compartilhados entre Área do aluno e Meu perfil. */
export const portalAlunoConsulta = queryOptions({
  queryKey: ["portal-aluno"],
  queryFn: () => consultarPortalAluno({ data: { aparelho: tokenAparelhoLocal() } }),
  staleTime: 0,
});
