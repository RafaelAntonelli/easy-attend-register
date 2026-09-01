import { montarPlanilhaAlunos, DOCUMENTOS_PLANILHA, type AlunoPlanilha } from "@/lib/planilha-alunos";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";

/** Pasta do Drive para as planilhas de exportação. */
export const PASTA_PLANILHAS = "1xCkat_TA0nT_zOW2yzw0myflN8jBO65n";
/** Pasta do Drive para fotos e documentos dos alunos. */
export const PASTA_IMAGENS = "1j7Llm91Q2Zp0JfFg1afhPRADDO_KmoOz";

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

/** Exporta a planilha do dia e todas as fotos/documentos para as pastas do Google Drive. */
export async function executarBackupCompleto(): Promise<Resultado> {
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

  const baixar = async (caminho: string) => {
    const { data } = await supabaseAdmin.storage.from("fotos-alunos").download(caminho);
    return data ? await data.arrayBuffer() : null;
  };

  const buffer = await montarPlanilhaAlunos({
    alunos: lista,
    turmaDoAluno,
    modalidadeDoAluno: (id) => matriculaDoAluno(id)?.modalidade ?? turmaDoAluno(id)?.modalidade ?? "",
    baixarArquivo: baixar,
  });

  const data = new Date().toISOString().slice(0, 10);
  const planilha = await enviarParaDrive({
    nome: `alunos-${data}.xlsx`,
    pasta: PASTA_PLANILHAS,
    conteudo: buffer,
    tipo: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const falhas: string[] = [];
  let imagens = 0;

  const arquivos: { caminho: string; nome: string }[] = [];
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

  for (const arquivo of arquivos) {
    try {
      const conteudo = await baixar(arquivo.caminho);
      if (!conteudo) {
        falhas.push(arquivo.nome);
        continue;
      }
      const ext = (arquivo.caminho.split(".").pop() ?? "").toLowerCase();
      const tipo =
        ext === "png" ? "image/png" : ext === "pdf" ? "application/pdf" : ext === "webp" ? "image/webp" : "image/jpeg";
      await enviarParaDrive({ nome: arquivo.nome, pasta: PASTA_IMAGENS, conteudo, tipo });
      imagens++;
    } catch (err) {
      console.error("[backup] falha ao enviar arquivo", arquivo.nome, err);
      falhas.push(arquivo.nome);
    }
  }

  return { planilha: planilha.nome, imagens, falhas };
}
