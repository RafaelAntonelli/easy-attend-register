import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { chaveLinkDrive, montarPlanilhaAlunos } from "./planilha-alunos";

describe("exportação da ficha do aluno", () => {
  it("exporta o link da ficha e deixa vazio quando não há arquivo", async () => {
    const id = "12345678-0000-4000-8000-000000000001";
    const url = "https://example.org/ficha-teste.jpg";
    const buffer = await montarPlanilhaAlunos({
      alunos: [
        { id, nome: "Aluno com ficha", idade: 20, doc_ficha_path: `${id}/ficha.jpg` },
        { id: "87654321-0000-4000-8000-000000000002", nome: "Aluno sem ficha", idade: 21 },
      ],
      turmaDoAluno: () => undefined,
      modalidadeDoAluno: () => "Natação",
      linksDrive: async () => ({
        links: { [chaveLinkDrive(id, "doc_ficha_path")]: url },
        expiraEm: "2026-10-21T19:00:00.000Z",
        horas: 24,
      }),
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.getWorksheet("Alunos");
    if (!ws) throw new Error("Planilha não gerada");
    const headers = ws.getRow(1).values as string[];
    const column = headers.indexOf("Link - Ficha");
    expect(column).toBeGreaterThan(0);
    expect(ws.getCell(2, column).value).toEqual({ text: "Ficha - Aluno com ficha", hyperlink: url });
    expect(ws.getCell(3, column).text).toBe("");
  });

  it("avisa na planilha quando os links temporários expiram", async () => {
    const id = "12345678-0000-4000-8000-000000000001";
    const buffer = await montarPlanilhaAlunos({
      alunos: [{ id, nome: "Aluno", idade: 20, foto_path: `${id}/foto.jpg` }],
      turmaDoAluno: () => undefined,
      modalidadeDoAluno: () => "Natação",
      linksDrive: async () => ({
        links: { [chaveLinkDrive(id, "foto_path")]: "https://example.org/f.jpg" },
        expiraEm: "2026-10-21T19:00:00.000Z",
        horas: 24,
      }),
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const info = wb.getWorksheet("Sobre os links");
    expect(info?.getCell(2, 1).text).toContain("21/10/2026");
    expect(info?.getCell(2, 1).text).toContain("24 h");
  });
});