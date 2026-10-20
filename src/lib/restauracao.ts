import { codigoMatriculaValido } from "@/lib/backup-nomes";

/** Uma linha da planilha do backup, já lida pelo cabeçalho. */
export type LinhaRestauracao = {
  codigo: string;
  nome: string;
  turma: string;
  modalidade: string;
  aluno: {
    codigo: string;
    nome: string;
    sexo: string | null;
    idade: number | null;
    faixa_etaria: string | null;
    data_nascimento: string | null;
    cpf: string | null;
    rg: string | null;
    telefone: string | null;
    telefone2: string | null;
    email: string | null;
    responsavel: string | null;
    rede_ensino: string | null;
    escola: string | null;
    pcd: boolean;
    pcd_condicoes: string[];
    atestado_entregue: boolean;
    atestado_data: string | null;
    observacoes: string | null;
    ativo: boolean;
    motivo_inativacao: string | null;
  };
};

export function normalizarCabecalho(texto: unknown) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Aceita AAAA-MM-DD e DD/MM/AAAA; devolve AAAA-MM-DD ou null. */
export function converterData(valor: unknown): string | null {
  const t = String(valor ?? "").trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m?.[1] && m[2] && m[3]) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function texto(valor: unknown): string | null {
  const t = String(valor ?? "").trim();
  return t ? t : null;
}

function simNao(valor: unknown) {
  return normalizarCabecalho(valor) === "sim";
}

/**
 * Lê as linhas da planilha do backup (primeira linha com "Código de matrícula" é o cabeçalho).
 * Linhas sem código válido são contadas à parte; códigos repetidos ficam só com a primeira linha.
 */
export function lerLinhasPlanilha(linhas: unknown[][]): {
  linhas: LinhaRestauracao[];
  semCodigo: number;
  repetidos: string[];
} {
  const indiceCabecalho = linhas.findIndex((l) => l.some((c) => normalizarCabecalho(c) === "codigo de matricula"));
  if (indiceCabecalho < 0) throw new Error('A planilha não tem a coluna "Código de matrícula".');
  const cabecalho = (linhas[indiceCabecalho] ?? []).map(normalizarCabecalho);
  const col = (nome: string) => cabecalho.indexOf(normalizarCabecalho(nome));
  const indices = {
    codigo: col("Código de matrícula"), nome: col("Nome"), sexo: col("Sexo"), idade: col("Idade"),
    faixa: col("Faixa etária"), nascimento: col("Nascimento"), cpf: col("CPF"), rg: col("RG"),
    celular: col("Celular"), celular2: col("Celular 2"), email: col("E-mail"), responsavel: col("Responsável"),
    rede: col("Rede de ensino"), escola: col("Escola"), pcd: col("PCD"), condicoes: col("Condições PCD"),
    atestado: col("Atestado entregue"), atestadoData: col("Data do atestado"), modalidade: col("Modalidade"),
    turma: col("Turma"), situacao: col("Situação"), observacoes: col("Observações"),
  };
  const valor = (linha: unknown[], i: number) => (i >= 0 ? linha[i] : undefined);
  const vistos = new Set<string>();
  const repetidos = new Set<string>();
  const resultado: LinhaRestauracao[] = [];
  let semCodigo = 0;
  for (const linha of linhas.slice(indiceCabecalho + 1)) {
    if (!linha.some((c) => String(c ?? "").trim())) continue;
    const codigo = String(valor(linha, indices.codigo) ?? "").trim().toUpperCase();
    const nome = String(valor(linha, indices.nome) ?? "").trim();
    if (!codigoMatriculaValido(codigo) || !nome) {
      semCodigo++;
      continue;
    }
    if (vistos.has(codigo)) {
      repetidos.add(codigo);
      continue;
    }
    vistos.add(codigo);
    const idade = Number.parseInt(String(valor(linha, indices.idade) ?? ""), 10);
    const ativo = normalizarCabecalho(valor(linha, indices.situacao)) !== "inativo";
    resultado.push({
      codigo,
      nome,
      turma: String(valor(linha, indices.turma) ?? "").trim(),
      modalidade: String(valor(linha, indices.modalidade) ?? "").trim(),
      aluno: {
        codigo,
        nome,
        sexo: texto(valor(linha, indices.sexo)),
        idade: Number.isFinite(idade) ? idade : null,
        faixa_etaria: texto(valor(linha, indices.faixa)),
        data_nascimento: converterData(valor(linha, indices.nascimento)),
        cpf: texto(valor(linha, indices.cpf)),
        rg: texto(valor(linha, indices.rg)),
        telefone: texto(valor(linha, indices.celular)),
        telefone2: texto(valor(linha, indices.celular2)),
        email: texto(valor(linha, indices.email)),
        responsavel: texto(valor(linha, indices.responsavel)),
        rede_ensino: texto(valor(linha, indices.rede)),
        escola: texto(valor(linha, indices.escola)),
        pcd: simNao(valor(linha, indices.pcd)),
        pcd_condicoes: String(valor(linha, indices.condicoes) ?? "")
          .split("|")
          .map((c) => c.trim())
          .filter(Boolean),
        atestado_entregue: simNao(valor(linha, indices.atestado)),
        atestado_data: converterData(valor(linha, indices.atestadoData)),
        observacoes: texto(valor(linha, indices.observacoes)),
        ativo,
        motivo_inativacao: ativo ? null : "Restaurado do backup como inativo",
      },
    });
  }
  return { linhas: resultado, semCodigo, repetidos: Array.from(repetidos) };
}

/** Aceita o link do Google Drive/Planilhas ou o ID do arquivo. */
export function extrairIdArquivoDrive(valor?: string | null): string {
  const bruto = (valor ?? "").trim();
  if (!bruto) return "";
  const porUrl = bruto.match(/\/d\/([A-Za-z0-9_-]{10,})/) ?? bruto.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (porUrl?.[1]) return porUrl[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(bruto) ? bruto : "";
}
