const PREFIXO = "arena:liberar-aparelho:v1:";

export function lerQrAparelho(valor: string): string | null {
  if (!valor.startsWith(PREFIXO)) return null;
  const codigo = valor.slice(PREFIXO.length);
  return /^[A-F0-9]{12}$/.test(codigo) ? codigo : null;
}

export function gerarQrAparelho(codigo: string): string {
  if (!/^[A-F0-9]{12}$/.test(codigo)) throw new Error("Código de aparelho inválido.");
  return `${PREFIXO}${codigo}`;
}