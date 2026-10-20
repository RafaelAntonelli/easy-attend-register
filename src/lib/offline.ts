import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Armazenamento local (IndexedDB) para funcionamento sem internet
// ---------------------------------------------------------------------------

const DB_NOME = "arena-offline";
const DB_VERSAO = 1;
const STORE_FILA = "fila";
const STORE_CACHE = "cache";

/**
 * Metadados de cada ação guardada offline: ID único, carimbo UTC e número de
 * sequência no aparelho. A fila é enviada estritamente nessa ordem.
 */
type MetaFila = {
  id: string;
  /** Milissegundos desde 1970 (UTC). */
  criado_em: number;
  /** Mesmo instante em ISO 8601 UTC (ex.: 2026-10-20T19:34:00.000Z). */
  criado_em_utc?: string;
  /** Ordem de execução no aparelho, desempata ações no mesmo milissegundo. */
  seq?: number;
  /** Último erro ao enviar (a fila para nesta ação até ser resolvida). */
  erro?: string | null;
  tentativas?: number;
};

export type OperacaoFila = MetaFila & (
  | { tipo: "aluno_novo"; aluno: Record<string, unknown>; foto?: Blob | null; fotoNome?: string | null }
  | { tipo: "aluno_update"; aluno_id: string; dados: Record<string, unknown>; foto?: Blob | null; fotoNome?: string | null }
  | { tipo: "matricula"; aluno_id: string; turma_id: string; modalidade: string; registrado_por?: string | null }
  | {
      tipo: "presenca";
      aluno_id: string;
      turma_id: string | null;
      data: string;
      status: string;
      metodo: string;
      observacoes: string | null;
      horario: string;
    }
  | { tipo: "presenca_remover"; aluno_id: string; data: string }
);

function suportado() {
  return typeof indexedDB !== "undefined";
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOME, DB_VERSAO);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_FILA)) db.createObjectStore(STORE_FILA, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORE_CACHE)) db.createObjectStore(STORE_CACHE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function comStore<T>(store: string, modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await abrir();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, modo);
    const req = fn(tx.objectStore(store));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

// ------------------------------- Cache de dados ----------------------------

export async function salvarCache(chave: string, valor: unknown) {
  if (!suportado()) return;
  try {
    await comStore(STORE_CACHE, "readwrite", (s) => s.put(valor, chave));
  } catch {
    /* ignora */
  }
}

export async function lerCache<T>(chave: string): Promise<T | null> {
  if (!suportado()) return null;
  try {
    const v = await comStore<T>(STORE_CACHE, "readonly", (s) => s.get(chave));
    return (v as T) ?? null;
  } catch {
    return null;
  }
}

// ------------------------------- Fila de sincronização ---------------------

const ouvintes = new Set<() => void>();

export function assinarFila(fn: () => void) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

function notificar() {
  ouvintes.forEach((f) => f());
}

export async function listarFila(): Promise<OperacaoFila[]> {
  if (!suportado()) return [];
  try {
    const itens = await comStore<OperacaoFila[]>(STORE_FILA, "readonly", (s) => s.getAll());
    return ordenarFila(itens ?? []);
  } catch {
    return [];
  }
}

/** Ordem exata de execução: instante UTC e, no mesmo instante, a sequência do aparelho. */
export function ordenarFila<T extends { criado_em: number; seq?: number }>(itens: T[]): T[] {
  return [...itens].sort((a, b) => a.criado_em - b.criado_em || (a.seq ?? 0) - (b.seq ?? 0));
}

type SemMeta<T> = T extends unknown ? Omit<T, keyof MetaFila> & { id?: string } : never;

const CHAVE_SEQ = "arena:fila-seq";
let ultimaSeq = 0;
let ultimoInstante = 0;

/** Próximo número de sequência, persistido para continuar crescendo entre aberturas do app. */
function proximaSeq() {
  try {
    ultimaSeq = Math.max(ultimaSeq, Number(localStorage.getItem(CHAVE_SEQ)) || 0);
  } catch {
    /* sem armazenamento local: mantém a sequência em memória */
  }
  ultimaSeq += 1;
  try {
    localStorage.setItem(CHAVE_SEQ, String(ultimaSeq));
  } catch {
    /* ignora */
  }
  return ultimaSeq;
}

export async function enfileirar(op: SemMeta<OperacaoFila>): Promise<string> {
  const id = op.id ?? crypto.randomUUID();
  // O instante nunca volta atrás, mesmo se o relógio do aparelho for ajustado durante o uso.
  const agora = Math.max(Date.now(), ultimoInstante);
  ultimoInstante = agora;
  const registro = {
    ...op,
    id,
    criado_em: agora,
    criado_em_utc: new Date(agora).toISOString(),
    seq: proximaSeq(),
    erro: null,
    tentativas: 0,
  } as OperacaoFila;
  await comStore(STORE_FILA, "readwrite", (s) => s.put(registro));
  notificar();
  return id;
}

async function remover(id: string) {
  await comStore(STORE_FILA, "readwrite", (s) => s.delete(id));
  notificar();
}

async function marcarErro(op: OperacaoFila, erro: string) {
  const registro = { ...op, erro, tentativas: (op.tentativas ?? 0) + 1 } as OperacaoFila;
  await comStore(STORE_FILA, "readwrite", (s) => s.put(registro));
  notificar();
}

/** Remove da fila uma ação que não pode ser enviada (decisão do usuário), liberando as seguintes. */
export async function descartarDaFila(id: string) {
  await remover(id);
}

function mensagemErro(err: unknown) {
  if (err && typeof err === "object" && "message" in err) return String((err as { message: unknown }).message).slice(0, 300);
  return String(err).slice(0, 300);
}

export function estaOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

// ------------------------------- Sincronização -----------------------------

let sincronizando = false;

async function enviarFoto(alunoId: string, foto: Blob, nome?: string | null) {
  const ext = (nome?.split(".").pop() ?? "jpg").toLowerCase();
  const caminho = `${alunoId}/${Date.now()}.${ext}`;
  const up = await supabase.storage.from("fotos-alunos").upload(caminho, foto, { upsert: true });
  if (up.error) throw up.error;
  const { error } = await supabase.from("alunos").update({ foto_path: caminho }).eq("id", alunoId);
  if (error) throw error;
}

async function executar(op: OperacaoFila) {
  if (op.tipo === "aluno_novo") {
    const { error } = await supabase.from("alunos").upsert(op.aluno as never, { onConflict: "id" });
    if (error) throw error;
    if (op.foto) await enviarFoto(String(op.aluno["id"]), op.foto, op.fotoNome);
    return;
  }
  if (op.tipo === "aluno_update") {
    const { error } = await supabase.from("alunos").update(op.dados as never).eq("id", op.aluno_id);
    if (error) throw error;
    if (op.foto) await enviarFoto(op.aluno_id, op.foto, op.fotoNome);
    return;
  }
  if (op.tipo === "matricula") {
    await supabase.from("matriculas").delete().eq("aluno_id", op.aluno_id).neq("turma_id", op.turma_id);
    const { error } = await supabase
      .from("matriculas")
      .upsert({ aluno_id: op.aluno_id, turma_id: op.turma_id, status: "ativa", modalidade: op.modalidade, registrado_por: op.registrado_por ?? null }, { onConflict: "aluno_id,turma_id" });
    if (error) throw error;
    return;
  }
  const instante = instanteUtc(op);
  if (op.tipo === "presenca_remover") {
    // Só remove se ninguém registrou essa presença depois desta ação.
    const { error } = await supabase
      .from("presencas")
      .delete()
      .eq("aluno_id", op.aluno_id)
      .eq("data", op.data)
      .lte("executado_em", instante);
    if (error) throw error;
    return;
  }
  // presença: substitui o registro do dia, se existir e for mais antigo que esta ação
  const existente = await supabase
    .from("presencas")
    .select("id,executado_em")
    .eq("aluno_id", op.aluno_id)
    .eq("data", op.data)
    .maybeSingle();
  if (existente.error) throw existente.error;
  if (existente.data) {
    const { error } = await supabase
      .from("presencas")
      .update({
        status: op.status,
        metodo: op.metodo,
        turma_id: op.turma_id,
        horario: op.horario,
        observacoes: op.observacoes,
        executado_em: instante,
      })
      .eq("id", existente.data.id)
      .lte("executado_em", instante);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("presencas").insert({
      aluno_id: op.aluno_id,
      turma_id: op.turma_id,
      data: op.data,
      status: op.status,
      metodo: op.metodo,
      observacoes: op.observacoes,
      horario: op.horario,
      executado_em: instante,
    } as never);
    if (error) throw error;
  }
}

/** Instante UTC (ISO) em que a ação foi feita no aparelho. */
export function instanteUtc(op: Pick<OperacaoFila, "criado_em" | "criado_em_utc">) {
  return op.criado_em_utc ?? new Date(op.criado_em).toISOString();
}

export type ResultadoSync = { enviados: number; falhas: number; bloqueada?: { id: string; erro: string } | undefined };

export async function sincronizar(): Promise<ResultadoSync> {
  if (sincronizando || !estaOnline()) return { enviados: 0, falhas: 0 };
  sincronizando = true;
  let enviados = 0;
  let falhas = 0;
  let bloqueada: ResultadoSync["bloqueada"];
  try {
    // Envia uma ação por vez, na ordem em que foram feitas. Se uma falhar, as
    // seguintes esperam: assim uma presença nunca chega antes da matrícula do aluno.
    const fila = await listarFila();
    for (const op of fila) {
      if (!estaOnline()) break;
      try {
        await executar(op);
        await remover(op.id);
        enviados++;
      } catch (err) {
        falhas++;
        const erro = mensagemErro(err);
        bloqueada = { id: op.id, erro };
        await marcarErro(op, erro).catch(() => undefined);
        break;
      }
    }
  } finally {
    sincronizando = false;
  }
  return { enviados, falhas, bloqueada };
}
