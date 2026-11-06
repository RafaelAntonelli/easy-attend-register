import { supabase } from "@/integrations/supabase/client";
import { contaOffline, salvarCache } from "./offline";

let preparando: string | null = null;

/** Download staff snapshots while authenticated; never cache API responses in the worker. */
export async function prepararDadosOffline(usuarioId: string) {
  if (preparando || !navigator.onLine) return;
  preparando = usuarioId;
  try {
    const alunos: import("@/integrations/supabase/types").Tables<"alunos">[] = [];
    const matriculas: import("@/integrations/supabase/types").Tables<"matriculas">[] = [];
    for (let inicio = 0; ; inicio += 500) {
      const { data, error } = await supabase.from("alunos").select("*").order("id").range(inicio, inicio + 499);
      if (error) throw error;
      alunos.push(...(data ?? []));
      if ((data?.length ?? 0) < 500) break;
    }
    for (let inicio = 0; ; inicio += 500) {
      const { data, error } = await supabase.from("matriculas").select("*").order("id").range(inicio, inicio + 499);
      if (error) throw error;
      matriculas.push(...(data ?? []));
      if ((data?.length ?? 0) < 500) break;
    }
    const [t, l] = await Promise.all([
      supabase.from("turmas").select("id,nome,horario,dias_semana,modalidade,capacidade").order("nome"),
      supabase.from("licencas_medicas").select("id,aluno_id,data_inicio,data_retorno,motivo,encerrada_em").is("encerrada_em", null),
    ]);
    if (t.error || l.error || contaOffline() !== usuarioId) return;
    await salvarCache("alunos", { alunos, turmas: t.data, matriculas });
    await salvarCache("presenca", { alunos: alunos.filter((a) => a.ativo), turmas: t.data, matriculas: matriculas.filter((m) => m.status === "ativa"), licencas: l.data });
    await salvarCache("preparado-em", new Date().toISOString());
    window.dispatchEvent(new Event("arena:preparado-offline"));
  } finally { preparando = null; }
}