import { apenasDigitos } from "@/lib/formatacao";

export type AlunoBasico = {
  id: string;
  nome: string;
  cpf?: string | null;
  data_nascimento?: string | null;
};

export type DadosMatricula = {
  nome: string;
  cpf?: string | null;
  data_nascimento?: string | null;
};

function normalizarNome(nome: string) {
  return nome.trim().toLowerCase();
}

/**
 * Critério único de duplicidade (mesmo usado pelo banco de dados):
 * - mesmo CPF (comparando apenas dígitos), ou
 * - mesmo nome + mesma data de nascimento.
 * Telefone NUNCA é considerado: irmãos/famílias compartilham o número.
 * Retorna o aluno duplicado ou null.
 */
export function encontrarAlunoDuplicado<T extends AlunoBasico>(
  dados: DadosMatricula,
  alunos: T[],
  ignorarId?: string | null,
): T | null {
  const cpfNovo = apenasDigitos(dados.cpf ?? "");
  const nomeNovo = normalizarNome(dados.nome ?? "");

  for (const a of alunos) {
    if (ignorarId && a.id === ignorarId) continue;

    const cpfA = apenasDigitos(a.cpf ?? "");
    if (cpfNovo.length === 11 && cpfA.length === 11 && cpfA === cpfNovo) return a;

    if (nomeNovo && normalizarNome(a.nome) === nomeNovo) {
      if (dados.data_nascimento && a.data_nascimento && a.data_nascimento === dados.data_nascimento) return a;
    }
  }
  return null;
}
