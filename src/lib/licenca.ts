/** Regras da licença médica (afastamento temporário com vaga preservada). */

export type Licenca = {
  id: string;
  aluno_id: string;
  data_inicio: string;
  data_retorno: string;
  motivo: string | null;
  encerrada_em: string | null;
};

/** Licença em vigor na data (inclui o dia de início, exclui o dia do retorno). */
export function licencaEmVigor(l: Licenca, data: string) {
  return !l.encerrada_em && l.data_inicio <= data && data < l.data_retorno;
}

/** Retorno previsto chegou e a licença ainda não foi encerrada: avisar a equipe. */
export function retornoPendente(l: Licenca, data: string) {
  return !l.encerrada_em && l.data_retorno <= data;
}

export function dataBR(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");
}

export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
