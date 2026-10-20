import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  GATEWAY,
  MIME_PASTA,
  cabecalhosDrive,
  erroDrive,
  listarPasta,
  pastasDrive,
  type ArquivoDrive,
} from "@/lib/backup.server";
import {
  TIPOS_ARQUIVO_BACKUP,
  interpretarNomeArquivoBackup,
  tipoConteudoPorExtensao,
  type CampoArquivoBackup,
} from "@/lib/backup-nomes";
import { lerLinhasPlanilha, extrairIdArquivoDrive, type LinhaRestauracao } from "@/lib/restauracao";

type Cliente = SupabaseClient<Database>;

const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MIME_SHEETS = "application/vnd.google-apps.spreadsheet";
const CAMPOS = TIPOS_ARQUIVO_BACKUP.map((t) => t.campo);

export type ArquivoRestauracao = {
  driveId: string;
  nome: string;
  codigo: string;
  campo: CampoArquivoBackup;
  /** repor: aluno sem esse arquivo; existente: aluno já tem; novo_aluno: aluno será recriado. */
  situacao: "repor" | "existente" | "novo_aluno";
};

export type AnaliseRestauracao = {
  planilha: { id: string; nome: string };
  totalLinhas: number;
  jaCadastrados: number;
  aRecriar: { codigo: string; nome: string }[];
  semCodigo: number;
  repetidos: string[];
  arquivos: ArquivoRestauracao[];
  naoVinculados: { nome: string; motivo: string }[];
};

/** Localiza a planilha informada ou a mais recente da pasta de planilhas do backup. */
async function localizarPlanilha(informada?: string | null): Promise<{ id: string; nome: string; mimeType: string }> {
  const id = extrairIdArquivoDrive(informada);
  if (informada?.trim() && !id) throw new Error("Link ou ID da planilha inválido.");
  if (id) {
    const resp = await fetch(`${GATEWAY}/drive/v3/files/${id}?fields=id,name,mimeType,trashed&supportsAllDrives=true`, {
      headers: cabecalhosDrive(),
    });
    if (resp.status === 404) throw new Error("Planilha não encontrada no Google Drive ou sem acesso.");
    if (!resp.ok) throw await erroDrive(resp);
    const json = (await resp.json()) as { id: string; name: string; mimeType: string; trashed?: boolean };
    if (json.trashed) throw new Error("A planilha está na lixeira do Drive.");
    return { id: json.id, nome: json.name, mimeType: json.mimeType };
  }
  const pastas = await pastasDrive();
  const q = `'${pastas.planilhas}' in parents and trashed = false and (mimeType = '${MIME_XLSX}' or mimeType = '${MIME_SHEETS}')`;
  const resp = await fetch(
    `${GATEWAY}/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=modifiedTime desc&pageSize=1&fields=files(id,name,mimeType)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: cabecalhosDrive() },
  );
  if (!resp.ok) throw await erroDrive(resp);
  const arquivo = ((await resp.json()) as { files?: { id: string; name: string; mimeType: string }[] }).files?.[0];
  if (!arquivo) throw new Error("Nenhuma planilha encontrada na pasta de planilhas do backup.");
  return { id: arquivo.id, nome: arquivo.name, mimeType: arquivo.mimeType };
}

async function baixarDoDrive(id: string, mimeType?: string): Promise<ArrayBuffer> {
  const url =
    mimeType === MIME_SHEETS
      ? `${GATEWAY}/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(MIME_XLSX)}`
      : `${GATEWAY}/drive/v3/files/${id}?alt=media&supportsAllDrives=true`;
  for (let tentativa = 1; ; tentativa++) {
    const resp = await fetch(url, { headers: cabecalhosDrive() });
    if (resp.ok) return await resp.arrayBuffer();
    if (![429, 500, 502, 503, 504].includes(resp.status) || tentativa >= 3) throw await erroDrive(resp);
    await new Promise((r) => setTimeout(r, 1500 * tentativa));
  }
}

/** Lê as linhas da planilha do backup guardada no Drive. */
export async function lerPlanilhaDrive(informada?: string | null) {
  const planilha = await localizarPlanilha(informada);
  const conteudo = await baixarDoDrive(planilha.id, planilha.mimeType);
  const XLSX = await import("xlsx");
  const livro = XLSX.read(new Uint8Array(conteudo), { type: "array" });
  const aba = livro.Sheets[livro.SheetNames[0] ?? ""];
  if (!aba) throw new Error("A planilha está vazia.");
  const linhas = XLSX.utils.sheet_to_json<unknown[]>(aba, { header: 1, raw: false, defval: "" });
  return { planilha, ...lerLinhasPlanilha(linhas) };
}

/** Lista os arquivos da pasta de fotos, da pasta de documentos e das subpastas de documentos. */
async function listarArquivosBackup(): Promise<ArquivoDrive[]> {
  const pastas = await pastasDrive();
  const [fotos, documentos] = await Promise.all([listarPasta(pastas.fotos), listarPasta(pastas.documentos)]);
  const subpastas = documentos.filter((f) => f.mimeType === MIME_PASTA);
  const dentro = await Promise.all(subpastas.map((p) => listarPasta(p.id)));
  return [...fotos, ...documentos, ...dentro.flat()].filter((f) => f.mimeType !== MIME_PASTA);
}

async function alunosPorCodigo(supabase: Cliente, codigos?: string[]) {
  const mapa = new Map<string, Record<string, string | null>>();
  const colunas = ["id", "codigo", "nome", ...CAMPOS].join(",");
  if (codigos) {
    for (let i = 0; i < codigos.length; i += 200) {
      const { data, error } = await supabase.from("alunos").select(colunas).in("codigo", codigos.slice(i, i + 200));
      if (error) throw new Error(error.message);
      for (const a of (data ?? []) as unknown as Record<string, string | null>[]) if (a["codigo"]) mapa.set(a["codigo"], a);
    }
    return mapa;
  }
  for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await supabase.from("alunos").select(colunas).order("id").range(inicio, inicio + 999);
    if (error) throw new Error(error.message);
    const lote = (data ?? []) as unknown as Record<string, string | null>[];
    for (const a of lote) if (a["codigo"]) mapa.set(a["codigo"], a);
    if (lote.length < 1000) break;
  }
  return mapa;
}

/** Prévia da restauração: nada é gravado. */
export async function analisarRestauracao(supabase: Cliente, informada?: string | null): Promise<AnaliseRestauracao> {
  const [leitura, arquivosDrive, cadastrados] = await Promise.all([
    lerPlanilhaDrive(informada),
    listarArquivosBackup(),
    alunosPorCodigo(supabase),
  ]);
  const naPlanilha = new Map(leitura.linhas.map((l) => [l.codigo, l]));
  const aRecriar = leitura.linhas.filter((l) => !cadastrados.has(l.codigo)).map((l) => ({ codigo: l.codigo, nome: l.nome }));

  const naoVinculados: AnaliseRestauracao["naoVinculados"] = [];
  const escolhidos = new Map<string, ArquivoDrive & { info: NonNullable<ReturnType<typeof interpretarNomeArquivoBackup>> }>();
  for (const arquivo of arquivosDrive) {
    const info = interpretarNomeArquivoBackup(arquivo.name);
    if (!info) {
      naoVinculados.push({ nome: arquivo.name, motivo: "Nome fora do padrão CÓDIGO_TIPO (ex.: A7B92K1_foto.jpg)" });
      continue;
    }
    if (!cadastrados.has(info.codigo) && !naPlanilha.has(info.codigo)) {
      naoVinculados.push({ nome: arquivo.name, motivo: "Código de matrícula não encontrado no sistema nem na planilha" });
      continue;
    }
    const chave = `${info.codigo}|${info.campo}`;
    const atual = escolhidos.get(chave);
    if (atual) {
      // Dois arquivos para o mesmo aluno e tipo: fica o mais recente.
      const novoMaisRecente = (arquivo.modifiedTime ?? "") > (atual.modifiedTime ?? "");
      naoVinculados.push({
        nome: novoMaisRecente ? atual.name : arquivo.name,
        motivo: "Arquivo repetido para o mesmo aluno (usado o mais recente)",
      });
      if (!novoMaisRecente) continue;
    }
    escolhidos.set(chave, { ...arquivo, info });
  }

  const arquivos: ArquivoRestauracao[] = Array.from(escolhidos.values()).map((a) => {
    const aluno = cadastrados.get(a.info.codigo);
    return {
      driveId: a.id,
      nome: a.name,
      codigo: a.info.codigo,
      campo: a.info.campo,
      situacao: !aluno ? "novo_aluno" : aluno[a.info.campo] ? "existente" : "repor",
    };
  });
  arquivos.sort((x, y) => x.nome.localeCompare(y.nome));

  return {
    planilha: { id: leitura.planilha.id, nome: leitura.planilha.nome },
    totalLinhas: leitura.linhas.length,
    jaCadastrados: leitura.linhas.length - aRecriar.length,
    aRecriar,
    semCodigo: leitura.semCodigo,
    repetidos: leitura.repetidos,
    arquivos,
    naoVinculados,
  };
}

/** Recria, com o mesmo código de matrícula, os alunos da planilha que não existem mais no sistema. */
export async function restaurarAlunos(
  supabase: Cliente,
  userId: string,
  planilhaId: string,
  codigos: string[],
): Promise<{ criados: number; jaExistiam: number; erros: string[] }> {
  const leitura = await lerPlanilhaDrive(planilhaId);
  const alvo = new Set(codigos);
  const linhas = leitura.linhas.filter((l) => alvo.has(l.codigo));
  const existentes = await alunosPorCodigo(supabase, linhas.map((l) => l.codigo));
  const { data: turmas } = await supabase.from("turmas").select("id,nome,modalidade");
  const turmaPorNome = new Map((turmas ?? []).map((t) => [t.nome.trim().toLowerCase(), t]));
  const erros: string[] = [];
  let criados = 0;
  let jaExistiam = 0;

  for (const linha of linhas) {
    if (existentes.has(linha.codigo)) {
      jaExistiam++;
      continue;
    }
    const { data, error } = await supabase.from("alunos").insert(linha.aluno).select("id").single();
    if (error || !data) {
      erros.push(`${linha.codigo} – ${linha.nome}: ${error?.message ?? "não foi possível recriar"}`);
      continue;
    }
    criados++;
    await matricularRestaurado(supabase, userId, data.id, linha, turmaPorNome, erros);
  }
  return { criados, jaExistiam, erros };
}

async function matricularRestaurado(
  supabase: Cliente,
  userId: string,
  alunoId: string,
  linha: LinhaRestauracao,
  turmaPorNome: Map<string, { id: string; nome: string; modalidade: string }>,
  erros: string[],
) {
  if (!linha.aluno.ativo || !linha.turma) return;
  const turma = turmaPorNome.get(linha.turma.toLowerCase());
  if (!turma) {
    erros.push(`${linha.codigo} – ${linha.nome}: turma "${linha.turma}" não existe mais; aluno recriado sem turma`);
    return;
  }
  const { error } = await supabase.from("matriculas").insert({
    aluno_id: alunoId,
    turma_id: turma.id,
    status: "ativa",
    modalidade: linha.modalidade || turma.modalidade,
    registrado_por: userId,
  });
  if (error) erros.push(`${linha.codigo} – ${linha.nome}: matrícula na turma não refeita (${error.message})`);
}

/** Baixa do Drive e liga cada arquivo ao aluno pelo código de matrícula do nome do arquivo. */
export async function restaurarArquivos(
  supabase: Cliente,
  arquivos: { driveId: string; nome: string; codigo: string; campo: CampoArquivoBackup }[],
  substituir: boolean,
): Promise<{ restaurados: number; pulados: number; erros: string[] }> {
  const alunos = await alunosPorCodigo(supabase, Array.from(new Set(arquivos.map((a) => a.codigo))));
  const erros: string[] = [];
  let restaurados = 0;
  let pulados = 0;
  for (const arquivo of arquivos) {
    const info = interpretarNomeArquivoBackup(arquivo.nome);
    // O nome do arquivo é a fonte da verdade: confere que código e tipo batem com o pedido.
    if (!info || info.codigo !== arquivo.codigo || info.campo !== arquivo.campo) {
      erros.push(`${arquivo.nome}: nome não corresponde ao aluno informado`);
      continue;
    }
    const aluno = alunos.get(arquivo.codigo);
    if (!aluno?.["id"]) {
      erros.push(`${arquivo.nome}: aluno ${arquivo.codigo} não está cadastrado`);
      continue;
    }
    if (aluno[arquivo.campo] && !substituir) {
      pulados++;
      continue;
    }
    try {
      const conteudo = await baixarDoDrive(arquivo.driveId);
      const alunoId = aluno["id"];
      const caminho =
        arquivo.campo === "foto_path"
          ? `${alunoId}/${Date.now()}.${info.extensao}`
          : `${alunoId}/${arquivo.campo}-${Date.now()}.${info.extensao}`;
      const up = await supabase.storage
        .from("fotos-alunos")
        .upload(caminho, conteudo, { upsert: true, contentType: tipoConteudoPorExtensao(info.extensao) });
      if (up.error) throw new Error(up.error.message);
      const { error } = await supabase
        .from("alunos")
        .update({ [arquivo.campo]: caminho } as never)
        .eq("id", alunoId);
      if (error) throw new Error(error.message);
      restaurados++;
    } catch (err) {
      erros.push(`${arquivo.nome}: ${err instanceof Error ? err.message.slice(0, 200) : "falha ao restaurar"}`);
    }
  }
  return { restaurados, pulados, erros };
}
