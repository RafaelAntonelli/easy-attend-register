/** Gera apenas o link de contato; não verifica se o celular possui WhatsApp. */
export function linkConversaWhatsApp(telefone: string | null | undefined, mensagem?: string): string | null {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  const nacional = digitos.length === 13 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
  if (!/^[1-9]\d9\d{8}$/.test(nacional)) return null;
  const base = `https://wa.me/55${nacional}`;
  return mensagem?.trim() ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}