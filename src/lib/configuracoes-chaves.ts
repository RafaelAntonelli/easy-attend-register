/** Chaves de configuração usadas tanto no cliente quanto no servidor. */
export const CHAVE_PASTA_PLANILHAS = "drive_pasta_planilhas";
export const CHAVE_PASTA_IMAGENS = "drive_pasta_imagens";
export const CHAVE_PASTA_DOCUMENTOS = "drive_pasta_documentos";

/**
 * Aceita o ID da pasta ou o link completo do Google Drive
 * (ex.: https://drive.google.com/drive/folders/ID?usp=drive_link) e devolve só o ID.
 */
export function extrairIdPastaDrive(valor?: string | null): string {
  const bruto = (valor ?? "").trim();
  if (!bruto) return "";
  const porUrl = bruto.match(/\/folders\/([A-Za-z0-9_-]+)/) ?? bruto.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (porUrl?.[1]) return porUrl[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(bruto) ? bruto : "";
}
