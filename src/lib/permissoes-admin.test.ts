import { expect, it } from "vitest";
import { confirmacaoValida } from "./permissoes-admin.server";

it("recusa confirmação ausente, incorreta ou vencida", () => {
  const registro = { token_hash: "teste", expires_at: "2026-10-16T23:43:00Z" };
  const agora = Date.parse("2026-10-16T23:33:00Z");
  expect(confirmacaoValida(null, "teste", agora)).toBe(false);
  expect(confirmacaoValida(registro, "outro", agora)).toBe(false);
  expect(confirmacaoValida(registro, "teste", Date.parse(registro.expires_at))).toBe(false);
  expect(confirmacaoValida(registro, "teste", agora)).toBe(true);
});