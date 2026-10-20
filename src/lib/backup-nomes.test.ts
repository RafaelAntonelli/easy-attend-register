import { describe, expect, it } from "vitest";
import { interpretarNomeArquivoBackup, nomeArquivoBackup } from "./backup-nomes";

describe("nomes dos arquivos do backup", () => {
  it("gera [CODIGO]_[TIPO].[extensão]", () => {
    expect(nomeArquivoBackup("A7B92K1", "doc_atestado_path", "x/doc_atestado_path-1.PDF")).toBe("A7B92K1_atestado.pdf");
    expect(nomeArquivoBackup("A7B92K1", "foto_path", "x/123.jpg")).toBe("A7B92K1_foto.jpg");
    expect(nomeArquivoBackup("A7B92K1", "doc_residencia_path", "x/a.pdf")).toBe("A7B92K1_comprovante_residencia.pdf");
    expect(nomeArquivoBackup("A7B92K1", "doc_identidade_path", "x/a.pdf")).toBe("A7B92K1_identidade.pdf");
    expect(nomeArquivoBackup("A7B92K1", "doc_ficha_path", "x/a.jpg")).toBe("A7B92K1_ficha.jpg");
  });

  it("recusa código de matrícula fora do padrão", () => {
    expect(() => nomeArquivoBackup("ABCDEFG", "foto_path", "a.jpg")).toThrow();
  });

  it("liga o arquivo ao aluno pelo código, não pelo nome", () => {
    expect(interpretarNomeArquivoBackup("A7B92K1_ficha.jpg")).toEqual({
      codigo: "A7B92K1",
      tipo: "ficha",
      campo: "doc_ficha_path",
      extensao: "jpg",
    });
    expect(interpretarNomeArquivoBackup("B1C2D3E_comprovante_residencia.pdf")?.campo).toBe("doc_residencia_path");
  });

  it("ignora nomes fora do padrão", () => {
    expect(interpretarNomeArquivoBackup("Maria - Foto [a1b2c3d4-foto].jpg")).toBeNull();
    expect(interpretarNomeArquivoBackup("A7B92K1_desconhecido.jpg")).toBeNull();
    expect(interpretarNomeArquivoBackup("A7B92K1_foto")).toBeNull();
  });
});
