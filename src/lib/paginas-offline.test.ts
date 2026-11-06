import { expect, it } from "vitest";
import { consultarPaginas } from "./paginas-offline";
it("salva todas as matrículas, sem cortar a lista em mil registros", async () => {
  const registros = Array.from({ length: 1201 }, (_, id) => ({ id }));
  const resultado = await consultarPaginas(async (inicio, fim) => ({ data: registros.slice(inicio, fim + 1), error: null }));
  expect(resultado.data?.length).toBe(1201);
  expect(resultado.data?.at(-1)?.id).toBe(1200);
});
it("não substitui os dados salvos por uma lista incompleta quando uma página falha", async () => {
  const resultado = await consultarPaginas(async (inicio) => inicio === 0 ? { data: Array.from({ length: 500 }, (_, id) => id), error: null } : { data: null, error: "Sem conexão" });
  expect(resultado.data).toBeNull();
  expect(resultado.error).toBe("Sem conexão");
});