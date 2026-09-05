import { idadePorNascimento, turnoDoHorario } from "@/lib/turnos";

export const DOCUMENTOS_PLANILHA = [
  { campo: "doc_atestado_path", rotulo: "Atestado médico" },
  { campo: "doc_residencia_path", rotulo: "Comprovante de residência" },
  { campo: "doc_matricula_path", rotulo: "Comprovante de matrícula escolar" },
  { campo: "doc_identidade_path", rotulo: "Documento de identidade" },
] as const;

export type CampoDocPlanilha = (typeof DOCUMENTOS_PLANILHA)[number]["campo"];

export type AlunoPlanilha = {
  id: string;
  nome: string;
  sexo?: string | null;
  idade?: number | null;
  data_nascimento?: string | null;
  cpf?: string | null;
  rg?: string | null;
  telefone?: string | null;
  telefone2?: string | null;
  email?: string | null;
  responsavel?: string | null;
  rede_ensino?: string | null;
  escola?: string | null;
  pcd?: boolean | null;
  pcd_condicoes?: string[] | null;
  faixa_etaria?: string | null;
  atestado_entregue?: boolean | null;
  atestado_data?: string | null;
  ativo?: boolean | null;
  observacoes?: string | null;
  foto_path?: string | null;
} & Partial<Record<CampoDocPlanilha, string | null>>;


export type TurmaPlanilha = { id: string; nome: string; modalidade?: string | null; horario?: string | null };

/** Idade efetiva usada para ordenar a planilha (nascimento tem prioridade). */
export function idadeEfetiva(aluno: AlunoPlanilha) {
  const calculada = Number(idadePorNascimento(aluno.data_nascimento));
  if (Number.isFinite(calculada)) return calculada;
  const informada = Number(aluno.idade);
  return Number.isFinite(informada) ? informada : Number.POSITIVE_INFINITY;
}

export type OpcoesPlanilha = {
  alunos: AlunoPlanilha[];
  turmaDoAluno: (id: string) => TurmaPlanilha | undefined;
  modalidadeDoAluno: (id: string) => string;
  /** Baixa um arquivo do storage para embutir a imagem na planilha. */
  baixarArquivo?: (caminho: string) => Promise<ArrayBuffer | null>;
  /** Permite cancelar a exportação no meio (o download das imagens é o passo demorado). */
  sinal?: AbortSignal | undefined;
  /** Progresso do processamento das linhas com imagens. */
  aoProgredir?: ((feitos: number, total: number) => void) | undefined;
  /** Gera links (URLs) para os arquivos: foto do aluno e documentos. */
  linksArquivos?: ((caminhos: string[]) => Promise<Record<string, string>>) | undefined;
};


/** Erro lançado quando o usuário cancela a exportação. */
export class ExportacaoCancelada extends Error {
  constructor() {
    super("Exportação cancelada");
    this.name = "ExportacaoCancelada";
  }
}

/** Monta a planilha de alunos em ordem crescente de idade, com as imagens dos documentos. */
export async function montarPlanilhaAlunos(opcoes: OpcoesPlanilha): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Alunos");

  const colunasBase = [
    "Nome", "Sexo", "Idade", "Faixa etária", "Nascimento", "CPF", "RG", "Celular", "Celular 2", "E-mail",
    "Responsável", "Rede de ensino", "Escola", "PCD", "Condições PCD", "Atestado entregue",
    "Data do atestado", "Modalidade", "Turma", "Horário", "Turno", "Situação", "Observações",
  ];
  const cabecalho = [
    ...colunasBase,
    ...DOCUMENTOS_PLANILHA.map((d) => d.rotulo),
    "Link da foto do aluno",
    ...DOCUMENTOS_PLANILHA.map((d) => `Link - ${d.rotulo}`),
  ];
  ws.addRow(cabecalho);
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  ws.getRow(1).height = 30;
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const ordenados = [...opcoes.alunos].sort((a, b) => {
    const diff = idadeEfetiva(a) - idadeEfetiva(b);
    if (diff !== 0 && Number.isFinite(diff)) return diff;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });

  let links: Record<string, string> = {};
  if (opcoes.linksArquivos) {
    const caminhos = ordenados.flatMap((a) =>
      [a.foto_path, ...DOCUMENTOS_PLANILHA.map((d) => a[d.campo])].filter((c): c is string => !!c),
    );
    if (caminhos.length) links = await opcoes.linksArquivos(caminhos);
  }
  const linkDe = (caminho?: string | null) => (caminho ? (links[caminho] ?? "") : "");

  const linhas = ordenados.map((a) => {
    const t = opcoes.turmaDoAluno(a.id);
    const idade = idadeEfetiva(a);
    return {
      aluno: a,
      valores: [
        a.nome,
        a.sexo ?? "",
        Number.isFinite(idade) ? idade : (a.idade ?? ""),
        a.faixa_etaria ?? "",
        a.data_nascimento ?? "",
        a.cpf ?? "",
        a.rg ?? "",
        a.telefone ?? "",
        a.telefone2 ?? "",
        a.email ?? "",
        a.responsavel ?? "",
        a.rede_ensino ?? "",
        a.escola ?? "",
        a.pcd ? "Sim" : "Não",
        (a.pcd_condicoes ?? []).join(" | "),
        a.atestado_entregue ? "Sim" : "Não",
        a.atestado_data ?? "",
        opcoes.modalidadeDoAluno(a.id),
        t?.nome ?? "",
        t?.horario ?? "",
        turnoDoHorario(t?.horario),
        a.ativo === false ? "Inativo" : "Ativo",
        a.observacoes ?? "",
        ...DOCUMENTOS_PLANILHA.map((d) => (a[d.campo] ? "Enviado" : "Pendente")),
        linkDe(a.foto_path),
        ...DOCUMENTOS_PLANILHA.map((d) => linkDe(a[d.campo])),
      ] as (string | number)[],
    };
  });

  linhas.forEach((l) => ws.addRow(l.valores));

  const colunaDocInicial = colunasBase.length;
  const colunaLinkFoto = colunasBase.length + DOCUMENTOS_PLANILHA.length + 1;

  // Links clicáveis, com o nome do arquivo como texto exibido
  for (let li = 0; li < linhas.length; li++) {
    const item = linhas[li];
    if (!item) continue;
    const linhaExcel = li + 2;
    const arquivos = [item.aluno.foto_path, ...DOCUMENTOS_PLANILHA.map((d) => item.aluno[d.campo])];
    arquivos.forEach((caminho, i) => {
      const url = linkDe(caminho);
      if (!url || !caminho) return;
      const celula = ws.getCell(linhaExcel, colunaLinkFoto + i);
      celula.value = { text: caminho.split("/").pop() || "Abrir arquivo", hyperlink: url };
      celula.font = { color: { argb: "FF0563C1" }, underline: true };
    });
  }

  const colunasLargas = ["Observações", "Condições PCD", "E-mail", "Escola", "Responsável"];
  cabecalho.forEach((titulo, i) => {
    const col = ws.getColumn(i + 1);
    let largura = titulo.length;
    col.eachCell({ includeEmpty: false }, (celula, numeroLinha) => {
      if (numeroLinha === 1) return;
      const v = celula.value as unknown;
      const texto =
        v && typeof v === "object" && "text" in (v as Record<string, unknown>)
          ? String((v as { text: unknown }).text ?? "")
          : String(v ?? "");
      largura = Math.max(largura, texto.length);
    });
    const quebra = colunasLargas.includes(titulo);
    col.width = Math.min(Math.max(largura + 2, 10), quebra ? 45 : 32);
    col.alignment = { vertical: "middle", wrapText: quebra };
  });

  for (let i = 0; i < DOCUMENTOS_PLANILHA.length; i++) ws.getColumn(colunaDocInicial + i + 1).width = 18;



  if (opcoes.baixarArquivo) {
    for (let li = 0; li < linhas.length; li++) {
      if (opcoes.sinal?.aborted) throw new ExportacaoCancelada();
      opcoes.aoProgredir?.(li, linhas.length);
      const item = linhas[li];
      if (!item) continue;
      const linhaExcel = li + 2;
      let temImagem = false;
      for (let di = 0; di < DOCUMENTOS_PLANILHA.length; di++) {
        const doc = DOCUMENTOS_PLANILHA[di];
        const caminho = doc ? item.aluno[doc.campo] : null;
        if (!caminho) continue;
        const ext = (caminho.split(".").pop() ?? "").toLowerCase();
        if (!["png", "jpg", "jpeg"].includes(ext)) continue;
        const buffer = await opcoes.baixarArquivo(caminho);
        if (!buffer) continue;
        const imageId = wb.addImage({ buffer, extension: ext === "png" ? "png" : "jpeg" });
        ws.addImage(imageId, {
          tl: { col: colunaDocInicial + di + 0.1, row: linhaExcel - 1 + 0.1 },
          ext: { width: 100, height: 70 },
        });
        temImagem = true;
      }
      if (temImagem) ws.getRow(linhaExcel).height = 60;
    }
  }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cabecalho.length } };
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
