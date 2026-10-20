import { describe, expect, it } from "vitest";
import { converterData, extrairIdArquivoDrive, lerLinhasPlanilha } from "./restauracao";

const CABECALHO = ["Código de matrícula", "Nome", "Nascimento", "PCD", "Condições PCD", "Turma", "Situação"];

describe("leitura da planilha do backup para restauração", () => {
  it("separa alunos de nome igual pelo código de matrícula", () => {
    const r = lerLinhasPlanilha([
      CABECALHO,
      ["A1B2C3D", "Maria Souza", "2010-05-01", "Não", "", "Natação T1", "Ativo"],
      ["Z9Y8X7W", "Maria Souza", "2012-02-03", "Sim", "TEA | TDAH", "", "Inativo"],
    ]);
    expect(r.linhas.map((l) => l.codigo)).toEqual(["A1B2C3D", "Z9Y8X7W"]);
    expect(r.linhas[1]?.aluno.pcd_condicoes).toEqual(["TEA", "TDAH"]);
    expect(r.linhas[1]?.aluno.ativo).toBe(false);
  });

  it("ignora linhas sem código válido e códigos repetidos", () => {
    const r = lerLinhasPlanilha([
      CABECALHO,
      ["", "Sem código", "", "", "", "", ""],
      ["A1B2C3D", "Primeira", "", "", "", "", ""],
      ["A1B2C3D", "Repetida", "", "", "", "", ""],
    ]);
    expect(r.semCodigo).toBe(1);
    expect(r.repetidos).toEqual(["A1B2C3D"]);
    expect(r.linhas).toHaveLength(1);
  });

  it("converte datas brasileiras", () => {
    expect(converterData("01/05/2010")).toBe("2010-05-01");
    expect(converterData("2010-05-01")).toBe("2010-05-01");
    expect(converterData("abc")).toBeNull();
  });

  it("lê o ID a partir do link do Drive", () => {
    expect(extrairIdArquivoDrive("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMn/edit")).toBe("1AbCdEfGhIjKlMn");
    expect(extrairIdArquivoDrive("https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view")).toBe("1AbCdEfGhIjKlMn");
  });
});
