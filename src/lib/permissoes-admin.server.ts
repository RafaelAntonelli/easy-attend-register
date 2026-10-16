export async function hashConfirmacao(token: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function confirmacaoValida(registro: { token_hash: string; expires_at: string } | null, hash: string, agora = Date.now()) {
  return Boolean(registro && registro.token_hash === hash && new Date(registro.expires_at).getTime() > agora);
}