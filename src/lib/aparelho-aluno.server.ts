import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { opcoesCookieAparelho } from "./aparelho-cookie";

export async function hashToken(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), b => b.toString(16).padStart(2, "0")).join("");
}
function tokenRecebido(enviado?: string) {
  const cookie = getCookie("arena-aparelho");
  if (cookie && /^[a-f0-9]{64}$/.test(cookie)) return cookie;
  return enviado && /^[a-f0-9]{64}$/.test(enviado) ? enviado : undefined;
}
export async function aparelhoAtual(enviado?: string) {
  const token = tokenRecebido(enviado);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const { data } = await supabaseAdmin.from("aparelhos_alunos").select("*").eq("token_hash", await hashToken(token)).gt("expires_at", new Date().toISOString()).maybeSingle();
  return data;
}
export function gravarAparelho(token: string) {
  setCookie("arena-aparelho", token, opcoesCookieAparelho(getRequest().url));
}
export async function limitarEntrada(enviado?: string) {
  const device = tokenRecebido(enviado);
  const ip = getRequest().headers.get("cf-connecting-ip") ?? "local";
  const limites: [string, number][] = [[`ip:${ip}`, 60]];
  if (device) limites.unshift([`device:${device}`, 10]);
  for (const [key, max] of limites) {
    const { data, error } = await supabaseAdmin.rpc("consumir_limite_portal", { _chave: await hashToken(key), _max: max });
    if (error || !data) throw new Error("Muitas tentativas. Aguarde 15 minutos.");
  }
}