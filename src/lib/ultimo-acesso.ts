/** Dias sem entrar no app a partir dos quais o último acesso fica destacado na Equipe. */
export const DIAS_ALERTA_ACESSO = 30;

export function descreverUltimoAcesso(iso: string | null, agora = new Date()): { texto: string; alerta: boolean } {
  if (!iso) return { texto: "nunca entrou", alerta: true };
  const quando = new Date(iso);
  if (Number.isNaN(quando.getTime())) return { texto: "—", alerta: false };
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
  const inicioDia = new Date(quando.getFullYear(), quando.getMonth(), quando.getDate()).getTime();
  const dias = Math.round((inicioHoje - inicioDia) / 86_400_000);
  const hora = quando.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const texto = dias <= 0 ? `hoje às ${hora}` : dias === 1 ? `ontem às ${hora}` : `há ${dias} dias`;
  return { texto, alerta: dias > DIAS_ALERTA_ACESSO };
}
