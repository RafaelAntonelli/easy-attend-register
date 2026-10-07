export const ESCOLAS_PUBLICAS = [
  "Colégio Estadual Bartolomeu de Gusmão",
  "Colégio Estadual Américo Simas",
  "Colégio Estadual Alfredo Agostinho de Deus",
  "Colégio Estadual Francisco Pereira Franco",
  "Colégio Estadual Hermano Gouveia Neto",
  "Colégio Estadual de Tempo Integral de Portão",
  "Escola Municipal Vila Praiana",
  "Escola Municipal Dom Avelar Brandão Vilela",
  "Escola Municipal Enock Amaral",
  "Escola Municipal José dos Santos Paranhos",
  "Escola Municipal Gregório Pinto de Almeida",
  "Centro Educacional Municipal Fênix",
  "CEI Maria de Oliveira Rodrigues",
  "Centro Educacional Olavina Calazans",
  "Centro Educacional Professor Emerson Palmeira",
  "Escola Municipal Ismael Ornelas Farias",
  "Escola Municipal Jacira Fernandes Mendes",
  "Escola Municipal do Loteamento Santa Júlia",
  "Escola Municipal Mercedes do Espírito Santo",
  "Escola Municipal Santa Rita",
  "Escola Municipal Senhora Valentina Silvina Santos",
  "Escola Municipal Vereador José Ramos",
  "Escola Municipal Vovó Ciça",
  "Escola Municipal Sônia Maria Pereira do Nascimento",
  "Escola Municipal Dois de Julho",
  "Escola Municipal Dinorah Pessoa",
  "Escola Fundamental São Judas Tadeu",
  "Escola Municipal Aurora Magalhães",
  "Escola Municipal Raimunda Brito da Cruz Santos",
  "Escola Municipal Dr. Paulo Malaquias de Mello",
  "Escola Municipal Jovina Moreira Rosa",
  "Escola Municipal Vila Nova de Portão",
  "Escola Municipal Pedro Paranhos",
  "CAIC – Centro de Atenção Integral à Criança e ao Adolescente",
  "Escola Municipal Engenho Caji",
  "Escola Municipal Vida Nova",
  "Escola Municipal Catarina de Sena",
  "Escola Municipal Quingoma",
  "Escola Municipal Tenente Gustavo dos Santos",
  "Escola Municipal Amauri Siqueira Montalvão",
  "Escola Municipal Capitulino dos Santos",
  "Escola Municipal Barro Duro",
  "Escola Municipal de Capiarara",
  "Centro Estadual de Educação Profissional em Tecnologia, Informação e Comunicação de Lauro de Freitas",
];

export const ESCOLAS_PRIVADAS = [
  "Colégio Perfil",
  "Colégio Adventista de Lauro de Freitas",
  "Colégio Pirâmide",
  "Colégio Impacto",
  "Colégio Sartre BSE",
  "Colégio Paraíso / Paraíso Máximus",
  "Colégio Apoio",
  "Colégio Acadêmico",
  "Sesi Lauro de Freitas",
  "Centro Educacional Estrela do Amanhã",
  "Centro Educacional Carpe Diem / Carpe Diem Kids",
  "Colégio Aurora do Saber",
  "Colégio Soleltrando",
  "Escola Flor de Jambo",
  "Educandário Mariza Pitanga",
  "CM Colégio Modelo",
  "Centro Educacional Conhecimento",
  "Centro Educacional Anne Araújo",
  "Centro Educacional Izaura Magalhães",
  "Centro Educacional Mariel / Mônica Patrícia",
  "CEPP – Centro Educacional Primeiros Passos",
  "Educandário Senhor do Bonfim",
  "Educandário Sonho de Criança",
  "Escola Aquarela",
  "Escola Batista Betânia",
  "Escola Brazílio",
];

export function escolasDaRede(rede: string): string[] {
  if (rede === "Pública") return ESCOLAS_PUBLICAS;
  if (rede === "Privada") return ESCOLAS_PRIVADAS;
  return [];
}

export type FiltroRedeEnsino = "todas" | "Pública" | "Privada";

export function filtrarAlunosPorRede<T extends { rede_ensino?: string | null }>(alunos: T[], rede: FiltroRedeEnsino): T[] {
  return rede === "todas" ? alunos : alunos.filter((aluno) => aluno.rede_ensino === rede);
}

export function agruparAlunosPorEscola<T extends { rede_ensino?: string | null; escola?: string | null }>(alunos: T[], rede: FiltroRedeEnsino) {
  const grupos = new Map<string, T[]>();
  for (const aluno of filtrarAlunosPorRede(alunos, rede)) {
    const nome = aluno.escola?.trim() || "Escola não informada";
    const grupo = grupos.get(nome);
    if (grupo) grupo.push(aluno);
    else grupos.set(nome, [aluno]);
  }
  return [...grupos.entries()]
    .map(([nome, lista]) => ({ nome, total: lista.length, alunos: lista }))
    .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
}