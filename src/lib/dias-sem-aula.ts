import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Dia sem aula: feriado, recesso ou aula cancelada. turma_id nulo = todas as turmas. */
export type DiaSemAula = {
  id: string;
  data: string;
  turma_id: string | null;
  motivo: string;
  criado_por_nome: string | null;
};

/**
 * Dias sem aula que valem para a data. Com turmas escolhidas, só os que valem para alguma delas
 * (os de "todas as turmas" sempre valem). A mesma regra é aplicada na falta automática no banco.
 */
export function diasSemAulaNaData(lista: DiaSemAula[], data: string, turmaIds: string[] = []) {
  return lista.filter(
    (d) => d.data === data && (d.turma_id === null || turmaIds.length === 0 || turmaIds.includes(d.turma_id)),
  );
}

/** A turma não tem aula na data? */
export function turmaSemAula(lista: DiaSemAula[], data: string, turmaId: string) {
  return lista.some((d) => d.data === data && (d.turma_id === null || d.turma_id === turmaId));
}

/** Próximos dias sem aula (a partir de `desde`), em ordem de data. */
export function proximosDiasSemAula(lista: DiaSemAula[], desde: string) {
  return lista.filter((d) => d.data >= desde).sort((a, b) => a.data.localeCompare(b.data));
}

export function useDiasSemAula() {
  const [lista, setLista] = useState<DiaSemAula[]>([]);
  const recarregar = useCallback(async () => {
    const limite = new Date();
    limite.setDate(limite.getDate() - 60);
    const { data } = await supabase
      .from("dias_sem_aula")
      .select("id,data,turma_id,motivo,criado_por_nome")
      .gte("data", limite.toISOString().slice(0, 10))
      .order("data");
    setLista((data ?? []) as DiaSemAula[]);
  }, []);
  useEffect(() => {
    void recarregar();
  }, [recarregar]);
  return { lista, recarregar };
}
