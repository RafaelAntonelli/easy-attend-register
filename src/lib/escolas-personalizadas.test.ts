import { beforeEach, describe, expect, it, vi } from "vitest";

const banco = vi.hoisted(() => ({ rows: new Map<string, string>(), falhar: false }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({
    upsert: async ({ chave, valor }: { chave: string; valor: string }) => {
      if (banco.falhar) return { error: new Error("sem conexão") };
      banco.rows.set(chave, valor);
      return { error: null };
    },
    select: () => ({ like: (_campo: string, filtro: string) => ({ order: async () => ({
      data: [...banco.rows].filter(([chave]) => chave.startsWith(filtro.slice(0, -1))).map(([, valor]) => ({ valor })),
      error: null,
    }) }) }),
  }) },
}));

import { lerEscolasPersonalizadas, salvarEscolaPersonalizada } from "./escolas-personalizadas";

beforeEach(() => { banco.rows.clear(); banco.falhar = false; });

describe("escolas adicionadas à lista", () => {
  it("mantém a escola salva em uma nova leitura para outra matrícula", async () => {
    await salvarEscolaPersonalizada("Pública", "  Escola Nova  ");
    await salvarEscolaPersonalizada("Pública", "Escola Outra");
    expect(await lerEscolasPersonalizadas("Pública")).toEqual(["Escola Nova", "Escola Outra"]);
  });

  it("mantém as adições separadas por rede pública e privada", async () => {
    await salvarEscolaPersonalizada("Pública", "Escola Municipal Nova");
    await salvarEscolaPersonalizada("Privada", "Colégio Novo");
    expect(await lerEscolasPersonalizadas("Pública")).toEqual(["Escola Municipal Nova"]);
    expect(await lerEscolasPersonalizadas("Privada")).toEqual(["Colégio Novo"]);
  });

  it("não informa salvamento quando a gravação falha", async () => {
    banco.falhar = true;
    await expect(salvarEscolaPersonalizada("Pública", "Escola Nova")).rejects.toThrow("sem conexão");
    expect(await lerEscolasPersonalizadas("Pública")).toEqual([]);
  });
});