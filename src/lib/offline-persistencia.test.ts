import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: api.getUser }, from: api.from } }));
import { definirContaOffline, enfileirar, lerCache, listarFila, salvarCache, sincronizar } from "./offline";

beforeEach(() => {
  const valores = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => valores.get(k) ?? null, setItem: (k: string, v: string) => valores.set(k, v), removeItem: (k: string) => valores.delete(k) });
  vi.stubGlobal("navigator", { onLine: true });
  api.getUser.mockReset(); api.from.mockReset();
});

describe("persistência e reconexão", () => {
  it("restaura dados da mesma conta, sem exibir dados de outra pessoa", async () => {
    definirContaOffline("conta-a");
    await salvarCache("presenca", { alunos: ["Aluno salvo"] });
    definirContaOffline("conta-b");
    expect(await lerCache("presenca")).toBeNull();
    definirContaOffline("conta-a");
    expect(await lerCache("presenca")).toEqual({ alunos: ["Aluno salvo"] });
  });
  it("guarda a chamada offline e envia exatamente uma vez ao reconectar na mesma conta", async () => {
    definirContaOffline("conta-sync");
    vi.stubGlobal("navigator", { onLine: false });
    await enfileirar({ tipo: "presenca", aluno_id: "aluno-teste", turma_id: "turma-teste", data: "2026-11-06", status: "presente", metodo: "manual", observacoes: null, horario: "2026-11-06T22:00:00Z" });
    expect((await listarFila()).length).toBe(1);
    expect(await sincronizar()).toEqual({ enviados: 0, falhas: 0 });
    vi.stubGlobal("navigator", { onLine: true });
    api.getUser.mockResolvedValue({ data: { user: { id: "conta-sync" } }, error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const select = { eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    api.from.mockReturnValue({ select: () => select, insert });
    expect((await sincronizar()).enviados).toBe(1);
    expect(await listarFila()).toEqual([]);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0]?.[0]).toMatchObject({ aluno_id: "aluno-teste", status: "presente", data: "2026-11-06" });
  });
  it("não envia chamadas de outra conta", async () => {
    definirContaOffline("conta-isolada");
    await enfileirar({ tipo: "presenca_remover", aluno_id: "teste", data: "2026-11-06" });
    api.getUser.mockResolvedValue({ data: { user: { id: "outra-conta" } }, error: null });
    expect((await sincronizar()).enviados).toBe(0);
    expect(api.from).not.toHaveBeenCalled();
    expect((await listarFila()).length).toBe(1);
  });
});