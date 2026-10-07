/** Gera apenas o link de contato; não verifica se o celular possui WhatsApp. */
export function linkConversaWhatsApp(telefone: string | null | undefined): string | null {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  const nacional = digitos.length === 13 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
  if (!/^[1-9]\d9\d{8}$/.test(nacional)) return null;
  return `https://wa.me/55${nacional}`;
}