import {
  CHAVE_PASTA_DOCUMENTOS,
  CHAVE_PASTA_IMAGENS,
  CHAVE_PASTA_PLANILHAS,
  extrairIdPastaDrive,
} from "@/lib/configuracoes-chaves";
import { montarPlanilhaAlunos, DOCUMENTOS_PLANILHA, type AlunoPlanilha } from "@/lib/planilha-alunos";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";

/** Pasta padrão do Drive para as planilhas de exportação. */
export const PASTA_PLANILHAS = "1xCkat_TA0nT_zOW2yzw0myflN8jBO65n";
/** Pasta padrão do Drive para as fotos dos alunos. */
export const PASTA_IMAGENS = "1j7Llm91Q2Zp0JfFg1afhPRADDO_KmoOz";
/** Pasta padrão do Drive para as imagens dos documentos dos alunos. */
export const PASTA_DOCUMENTOS = "1o-dAKikn44JlISnEK7IwUNrv-apownZ3";

export type PastasDrive = { planilhas: string; fotos: string; documentos: string };

/** Lê as pastas de destino configuradas pelo administrador (com fallback para os padrões). */
export async function pastasDrive(): Promise<PastasDrive> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("configuracoes")
      .select("chave,valor")
      .in("chave", [CHAVE_PASTA_PLANILHAS, CHAVE_PASTA_IMAGENS, CHAVE_PASTA_DOCUMENTOS]);
    const mapa = new Map((data ?? []).map((c: { chave: string; valor: string }) => [c.chave, c.valor]));
    return {
      planilhas: extrairIdPastaDrive(mapa.get(CHAVE_PASTA_PLANILHAS)) || PASTA_PLANILHAS,
      fotos: extrairIdPastaDrive(mapa.get(CHAVE_PASTA_IMAGENS)) || PASTA_IMAGENS,
      documentos: extrairIdPastaDrive(mapa.get(CHAVE_PASTA_DOCUMENTOS)) || PASTA_DOCUMENTOS,
    };
  } catch (err) {
    console.error("[backup] não foi possível ler as pastas configuradas", err);
    return { planilhas: PASTA_PLANILHAS, fotos: PASTA_IMAGENS, documentos: PASTA_DOCUMENTOS };
  }
}

function cabecalhosDrive() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const conexao = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lovable || !conexao) {
    throw new Error("Conexão com o Google Drive não configurada. Reconecte o Google Drive nos conectores.");
  }
  return {
    Authorization: `Bearer ${lovable}`,
    "X-Connection-Api-Key": conexao,
  };
}

async function erroDrive(resp: Response) {
  const corpo = await resp.text();
  console.error(`[backup] Google Drive [${resp.status}]: ${corpo}`);
  return new Error(`Google Drive respondeu ${resp.status}: ${corpo}`);
}

function nomeArquivoSeguro(texto: string) {
  return texto.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
}

async function procurarArquivo(nome: string, pasta: string) {
  const q = `name = '${nome.replace(/'/g, "\\'")}' and '${pasta}' in parents and trashed = false`;
  const url = `${GATEWAY}/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=1`;
  const resp = await fetch(url, { headers: cabecalhosDrive() });
  if (!resp.ok) throw await erroDrive(resp);
  const json = (await resp.json()) as { files?: { id: string }[] };
  return json.files?.[0]?.id ?? null;
}

/** Lista todos os arquivos de uma pasta de uma vez (evita uma busca por arquivo). */
async function listarPasta(pasta: string) {
  const mapa = new Map<string, string>();
  let pageToken: string | undefined;
  do {
    const q = `'${pasta}' in parents and trashed = false`;
    const url =
      `${GATEWAY}/drive/v3/files?q=${encodeURIComponent(q)}&fields=nextPageToken,files(id,name)&pageSize=1000` +
      (pageToken ? `&pageToken=${pageToken}` : "");
    const resp = await fetch(url, { headers: cabecalhosDrive() });
    if (!resp.ok) throw await erroDrive(resp);
    const json = (await resp.json()) as { files?: { id: string; name: string }[]; nextPageToken?: string };
    for (const f of json.files ?? []) mapa.set(f.name, f.id);
    pageToken = json.nextPageToken;
  } while (pageToken);
  return mapa;
}

/** Envia (ou substitui) um arquivo dentro de uma pasta do Drive. */
export async function enviarParaDrive(opcoes: {
  nome: string;
  pasta: string;
  conteudo: ArrayBuffer | Uint8Array;
  tipo: string;
  /** Índice de arquivos já existentes na pasta (evita uma busca por arquivo). */
  existentes?: Map<string, string>;
}) {
  const nome = nomeArquivoSeguro(opcoes.nome);
  const existente = opcoes.existentes ? (opcoes.existentes.get(nome) ?? null) : await procurarArquivo(nome, opcoes.pasta);

  let fileId = existente;
  if (!fileId) {
    const resp = await fetch(`${GATEWAY}/drive/v3/files?fields=id`, {
      method: "POST",
      headers: { ...cabecalhosDrive(), "Content-Type": "application/json" },
      body: JSON.stringify({ name: nome, parents: [opcoes.pasta], mimeType: opcoes.tipo }),
    });
    if (!resp.ok) throw await erroDrive(resp);
    fileId = ((await resp.json()) as { id: string }).id;
    opcoes.existentes?.set(nome, fileId);
  }

  const upload = await fetch(`${GATEWAY}/upload/drive/v3/files/${fileId}?uploadType=media&fields=id`, {
    method: "PATCH",
    headers: { ...cabecalhosDrive(), "Content-Type": opcoes.tipo },
    body: opcoes.conteudo as BodyInit,
  });
  if (!upload.ok) throw await erroDrive(upload);
  return { id: fileId, nome, substituido: Boolean(existente) };
}


type Resultado = {
  planilha: string;
  imagens: number;
  falhas: string[];
};

export type DestinoArquivo = "fotos" | "documentos";
export type ArquivoBackup = { caminho: string; nome: string; destino: DestinoArquivo };
/** Índices de arquivos já existentes, por pasta de destino. */
export type ExistentesBackup = Record<DestinoArquivo, Record<string, string>>;

function tipoPorExtensao(caminho: string) {
  const ext = (caminho.split(".").pop() ?? "").toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "pdf") return "application/pdf";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

async function baixarArquivoStorage(caminho: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.storage.from("fotos-alunos").download(caminho);
  return data ? await data.arrayBuffer() : null;
}

/** Gera e envia a planilha do dia e devolve a relação de fotos/documentos a enviar. */
export async function prepararBackup(): Promise<{
  planilha: string;
  arquivos: ArquivoBackup[];
  existentes: ExistentesBackup;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [{ data: alunos, error: erroAlunos }, { data: turmas }, { data: matriculas }] = await Promise.all([
    supabaseAdmin.from("alunos").select("*"),
    supabaseAdmin.from("turmas").select("*"),
    supabaseAdmin.from("matriculas").select("*"),
  ]);
  if (erroAlunos) throw erroAlunos;

  const lista = (alunos ?? []) as AlunoPlanilha[];
  const matriculaDoAluno = (id: string) => (matriculas ?? []).find((m) => m.aluno_id === id);
  const turmaDoAluno = (id: string) => {
    const m = matriculaDoAluno(id);
    return m ? (turmas ?? []).find((t) => t.id === m.turma_id) : undefined;
  };

  const buffer = await montarPlanilhaAlunos({
    alunos: lista,
    turmaDoAluno,
    modalidadeDoAluno: (id) => matriculaDoAluno(id)?.modalidade ?? turmaDoAluno(id)?.modalidade ?? "",
    baixarArquivo: baixarArquivoStorage,
  });

  const pastas = await pastasDrive();
  const data = new Date().toISOString().slice(0, 10);
  const planilha = await enviarParaDrive({
    nome: `alunos-${data}.xlsx`,
    pasta: pastas.planilhas,
    conteudo: buffer,
    tipo: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const arquivos: ArquivoBackup[] = [];
  for (const aluno of lista) {
    const registro = aluno as AlunoPlanilha & { foto_path?: string | null };
    if (registro.foto_path) {
      const ext = registro.foto_path.split(".").pop() ?? "jpg";
      arquivos.push({ caminho: registro.foto_path, nome: `${aluno.nome} - Foto.${ext}` });
    }
    for (const doc of DOCUMENTOS_PLANILHA) {
      const caminho = aluno[doc.campo];
      if (!caminho) continue;
      const ext = caminho.split(".").pop() ?? "jpg";
      arquivos.push({ caminho, nome: `${aluno.nome} - ${doc.rotulo}.${ext}` });
    }
  }

  const existentes = Object.fromEntries(await listarPasta((await pastasDrive()).imagens));
  return { planilha: planilha.nome, arquivos, existentes };
}

/** Envia um lote de fotos/documentos para a pasta de imagens do Drive. */
export async function enviarLoteBackup(
  arquivos: ArquivoBackup[],
  existentes?: Record<string, string>,
): Promise<{ enviados: number; falhas: string[] }> {
  const indice = new Map(Object.entries(existentes ?? {}));
  const pastaImagens = (await pastasDrive()).imagens;
  const falhas: string[] = [];
  let enviados = 0;
  const CONCORRENCIA = 8;
  let proximo = 0;

  async function trabalhador() {
    while (proximo < arquivos.length) {
      const arquivo = arquivos[proximo++];
      if (!arquivo) return;
      try {
        const conteudo = await baixarArquivoStorage(arquivo.caminho);
        if (!conteudo) {
          falhas.push(arquivo.nome);
          continue;
        }
        await enviarParaDrive({
          nome: arquivo.nome,
          pasta: pastaImagens,
          conteudo,
          tipo: tipoPorExtensao(arquivo.caminho),
          existentes: indice,
        });
        enviados++;
      } catch (err) {
        console.error("[backup] falha ao enviar arquivo", arquivo.nome, err);
        falhas.push(arquivo.nome);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCORRENCIA, arquivos.length) }, trabalhador));
  return { enviados, falhas };
}

/** Exporta a planilha do dia e todas as fotos/documentos para as pastas do Google Drive. */
export async function executarBackupCompleto(): Promise<Resultado> {
  const { planilha, arquivos, existentes } = await prepararBackup();
  const { enviados, falhas } = await enviarLoteBackup(arquivos, existentes);
  return { planilha, imagens: enviados, falhas };
}

