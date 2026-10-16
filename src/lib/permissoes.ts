import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Permissões configuráveis para todos os professores. Ausente no banco = ligada. */
export const PERMISSOES_PROFESSOR = [
  { area: "Alunos", chave: "alunos_cadastrar", rotulo: "Cadastrar alunos e fazer matrículas" },
  { area: "Alunos", chave: "alunos_editar", rotulo: "Editar e inativar alunos e matrículas" },
  { area: "Turmas", chave: "turmas_criar", rotulo: "Nova turma" },
  { area: "Turmas", chave: "horarios_editar", rotulo: "Editar horários" },
  { area: "Turmas", chave: "dias_editar", rotulo: "Editar dias" },
  { area: "Turmas", chave: "turmas_editar", rotulo: "Editar turma" },
  { area: "Presença", chave: "presenca_registrar", rotulo: "Registrar e editar presenças" },
  { area: "Saúde", chave: "licencas_gerenciar", rotulo: "Registrar, prorrogar e encerrar licenças médicas" },
  { area: "Fila de espera", chave: "fila_gerenciar", rotulo: "Adicionar, editar e remover da fila de espera" },
  { area: "Relatórios", chave: "relatorios_ver", rotulo: "Ver a tela Relatórios" },
  { area: "Configurações", chave: "configuracoes_editar", rotulo: "Mudar prazo do atestado e adicionar escolas" },
] as const;

export type ChavePermissao = (typeof PERMISSOES_PROFESSOR)[number]["chave"];

export function permissaoAtiva(mapa: Record<string, boolean>, chave: string) {
  return mapa[chave] ?? !["turmas_criar", "turmas_editar", "horarios_editar", "dias_editar"].includes(chave);
}

export function usePermissoesProfessor() {
  const [mapa, setMapa] = useState<Record<string, boolean>>({});
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    let ativo = true;
    void supabase
      .from("permissoes_professor")
      .select("chave, ativo")
      .then(({ data }) => {
        if (!ativo) return;
        setMapa(Object.fromEntries((data ?? []).map((p) => [p.chave, p.ativo])));
        setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);
  return { mapa, setMapa, carregando };
}

/** IDs das turmas ligadas ao usuário logado (para mostrá-las primeiro). */
export function useMinhasTurmas(userId: string | undefined) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!userId) return;
    void supabase
      .from("professor_turmas")
      .select("turma_id")
      .eq("user_id", userId)
      .then(({ data }) => setIds(new Set((data ?? []).map((r) => r.turma_id))));
  }, [userId]);
  return ids;
}
