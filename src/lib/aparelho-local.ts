// Browser copy of the device token: embedded previews and some browsers drop
// third-party cookies, so the token is also sent explicitly with portal calls.
const CHAVE = "arena-aparelho";
export function tokenAparelhoLocal(): string | undefined {
  try { const v = localStorage.getItem(CHAVE); return v && /^[a-f0-9]{64}$/.test(v) ? v : undefined; } catch { return undefined; }
}
export function salvarTokenAparelho(token: string) {
  try { localStorage.setItem(CHAVE, token); } catch { /* armazenamento indisponível */ }
}
