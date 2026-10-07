import { describe, expect, it } from "vitest";
import { agruparAlunosPorEscola, escolasDaRede, filtrarAlunosPorRede, parametroEscolasDaRede } from "./escolas";

describe("escolas por rede de ensino", () => {
  it("oferece as 44 escolas públicas informadas sem escolas privadas", () => {
    const escolas = escolasDaRede("Pública");
    expect(escolas).toHaveLength(44);
    expect(new Set(escolas).size).toBe(44);
    expect(escolas).toContain("Colégio Estadual Bartolomeu de Gusmão");
    expect(escolas).toContain("Centro Estadual de Educação Profissional em Tecnologia, Informação e Comunicação de Lauro de Freitas");
    expect(escolas).not.toContain("Colégio Perfil");
  });

  it("oferece as 26 escolas privadas informadas sem escolas públicas", () => {
    const escolas = escolasDaRede("Privada");
    expect(escolas).toHaveLength(26);
    expect(new Set(escolas).size).toBe(26);
    expect(escolas).toContain("Colégio Perfil");
    expect(escolas).toContain("Escola Brazílio");
    expect(escolas).not.toContain("Colégio Estadual Bartolomeu de Gusmão");
  });
});

describe("filtro de rede nos relatórios", () => {
  const alunos = [
    { id: "publica", rede_ensino: "Pública" },
    { id: "privada", rede_ensino: "Privada" },
    { id: "sem-rede", rede_ensino: null },
  ];

  it("mostra somente alunos da rede Pública", () => {
    expect(filtrarAlunosPorRede(alunos, "Pública").map((a) => a.id)).toEqual(["publica"]);
  });

  it("mostra somente alunos da rede Privada", () => {
    expect(filtrarAlunosPorRede(alunos, "Privada").map((a) => a.id)).toEqual(["privada"]);
  });

  it("inclui alunos sem rede informada quando o filtro é Todas", () => {
    expect(filtrarAlunosPorRede(alunos, "todas").map((a) => a.id)).toEqual(["publica", "privada", "sem-rede"]);
  });
});

describe("quantitativo por escola da rede selecionada", () => {
  it("reconhece a rede Pública como parâmetro exportável de escolas públicas", () => {
    expect(parametroEscolasDaRede("Pública")).toBe("escolas_publicas");
  });

  it("reconhece a rede Privada como parâmetro exportável de escolas privadas", () => {
    expect(parametroEscolasDaRede("Privada")).toBe("escolas_privadas");
  });

  it("não adiciona um parâmetro de escola sem rede selecionada", () => {
    expect(parametroEscolasDaRede("todas")).toBeNull();
  });
  const alunos = [
    { id: "1", rede_ensino: "Pública", escola: "Escola Municipal Vila Praiana" },
    { id: "2", rede_ensino: "Pública", escola: "Escola Municipal Vila Praiana" },
    { id: "3", rede_ensino: "Pública", escola: "Escola Municipal Santa Rita" },
    { id: "4", rede_ensino: "Privada", escola: "Colégio Perfil" },
    { id: "5", rede_ensino: "Privada", escola: "Colégio Perfil" },
    { id: "6", rede_ensino: "Privada", escola: null },
  ];

  it("conta alunos por escola apenas da rede Pública", () => {
    expect(agruparAlunosPorEscola(alunos, "Pública").map(({ nome, total }) => ({ nome, total }))).toEqual([
      { nome: "Escola Municipal Vila Praiana", total: 2 },
      { nome: "Escola Municipal Santa Rita", total: 1 },
    ]);
  });

  it("conta alunos por escola apenas da rede Privada, sem perder os sem escola", () => {
    const grupos = agruparAlunosPorEscola(alunos, "Privada");
    expect(grupos.map(({ nome, total }) => ({ nome, total }))).toEqual([
      { nome: "Colégio Perfil", total: 2 },
      { nome: "Escola não informada", total: 1 },
    ]);
    expect(grupos.flatMap((grupo) => grupo.alunos.map((aluno) => aluno.id))).toEqual(["4", "5", "6"]);
  });
});