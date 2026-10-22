/** Data de nascimento digitada como dd/mm/aaaa no login do aluno. */

export const EXEMPLO_NASCIMENTO = "15/11/1990";

/** Mantém só números e coloca as barras enquanto a pessoa digita. */
export function mascararNascimento(texto: string) {
  const d = texto.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Converte 1990-11-15 em 15/11/1990 (para logins salvos no formato antigo). */
export function isoParaNascimento(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : mascararNascimento(iso);
}

export type ResultadoNascimento = { ok: true; iso: string } | { ok: false; erro: string };

export function validarNascimento(texto: string, hoje = new Date()): ResultadoNascimento {
  const digitos = texto.replace(/\D/g, "");
  if (!digitos) return { ok: false, erro: "Informe a data de nascimento." };
  if (digitos.length < 8) {
    return { ok: false, erro: `Data incompleta. Digite dia, mês e ano com 4 dígitos. Exemplo: ${EXEMPLO_NASCIMENTO}.` };
  }
  const dia = Number(digitos.slice(0, 2));
  const mes = Number(digitos.slice(2, 4));
  const ano = Number(digitos.slice(4, 8));
  if (mes < 1 || mes > 12) return { ok: false, erro: `O mês deve ser de 01 a 12. Exemplo: ${EXEMPLO_NASCIMENTO}.` };
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (dia < 1 || data.getUTCDate() !== dia || data.getUTCMonth() !== mes - 1) {
    return { ok: false, erro: `Esse dia não existe nesse mês. Confira o dia e o mês. Exemplo: ${EXEMPLO_NASCIMENTO}.` };
  }
  if (ano < 1900) return { ok: false, erro: "Confira o ano de nascimento. Use os 4 dígitos, por exemplo 1990." };
  const hojeUtc = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (data.getTime() > hojeUtc) return { ok: false, erro: "A data de nascimento não pode ser depois de hoje." };
  const iso = `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  return { ok: true, iso };
}
