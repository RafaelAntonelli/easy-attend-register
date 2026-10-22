/** Textos do histórico de alterações da ficha do aluno. */

export type AlteracaoHistorico = { campo: string; antes: unknown; depois: unknown };
export type RegistroHistorico = { id: string; acao: string; alteracoes: AlteracaoHistorico[]; autor_nome: string | null; created_at: string };

export const ROTULOS_CAMPOS: Record<string, string> = {
  nome: "Nome",
  data_nascimento: "Data de nascimento",
  telefone: "Telefone",
  telefone2: "Outro telefone",
  responsavel: "Responsável",
  email: "E-mail",
  observacoes: "Observações",
  ativo: "Situação",
  motivo_inativacao: "Motivo da inativação",
  pcd: "PCD",
  pcd_descricao: "Descrição PCD",
  pcd_condicoes: "Condições PCD",
  foto_path: "Foto",
  atestado_entregue: "Atestado entregue",
  atestado_data: "Data do atestado",
  rede_ensino: "Rede de ensino",
  escola: "Escola",
  rg: "RG",
  cpf: "CPF",
  sexo: "Sexo",
  doc_atestado_path: "Foto do atestado",
  doc_residencia_path: "Comprovante de residência",
  doc_matricula_path: "Declaração de matrícula escolar",
  doc_identidade_path: "Documento de identidade",
  doc_ficha_path: "Ficha",
  turma: "Turma",
  status_matricula: "Situação da matrícula",
};

export const ROTULOS_ACAO: Record<string, string> = {
  cadastro: "Matrícula criada",
  alteracao: "Dados alterados",
  inativacao: "Aluno inativado",
  reativacao: "Aluno reativado",
  matricula: "Turma alterada",
};

export function rotuloCampo(campo: string) {
  return ROTULOS_CAMPOS[campo] ?? campo.replace(/_/g, " ");
}

/** Valor legível: datas no formato brasileiro, sim/não, listas e vazio. */
export function formatarValorHistorico(campo: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "vazio";
  if (campo === "ativo" && typeof valor === "boolean") return valor ? "Ativo" : "Inativo";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (Array.isArray(valor)) return valor.length ? valor.join(", ") : "vazio";
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor.split("-").reverse().join("/");
  return String(valor);
}

/** Uma frase por alteração, ex.: "Telefone: vazio → (71) 99999-0000". */
export function descreverAlteracao(a: AlteracaoHistorico) {
  if (a.campo === "turma") {
    if (a.antes == null) return `Matriculado na turma ${formatarValorHistorico(a.campo, a.depois)}`;
    if (a.depois == null) return `Saiu da turma ${formatarValorHistorico(a.campo, a.antes)}`;
  }
  return `${rotuloCampo(a.campo)}: ${formatarValorHistorico(a.campo, a.antes)} → ${formatarValorHistorico(a.campo, a.depois)}`;
}
