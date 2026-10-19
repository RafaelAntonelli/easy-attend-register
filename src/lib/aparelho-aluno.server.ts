import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function hashToken(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), b => b.toString(16).padStart(2, "0")).join("");
}
export async function aparelhoAtual() {
  const token = getCookie("arena-aparelho");
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const { data } = await supabaseAdmin.from("aparelhos_alunos").select("*").eq("token_hash", await hashToken(token)).gt("expires_at", new Date().toISOString()).maybeSingle();
  return data;
}
export function gravarAparelho(token: string) {
  setCookie("arena-aparelho", token, { httpOnly: true, secure: getRequest().url.startsWith("https:"), sameSite: "strict", path: "/", maxAge: 180 * 86400 });
}
export async function limitarEntrada() {
  const device = getCookie("arena-aparelho") ?? "sem-aparelho";
  const ip = getRequest().headers.get("cf-connecting-ip") ?? "local";
  for (const [key, max] of [[`device:${device}`, 10], [`ip:${ip}`, 60]] as const) {
    const { data, error } = await supabaseAdmin.rpc("consumir_limite_portal", { _chave: await hashToken(key), _max: max });
    if (error || !data) throw new Error("Muitas tentativas. Aguarde 15 minutos.");
  }
}