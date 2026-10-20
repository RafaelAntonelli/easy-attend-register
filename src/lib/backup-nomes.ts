/**
 * Nomes determinísticos dos arquivos do backup no Google Drive:
 *   [CODIGO_MATRICULA]_[TIPO_DOCUMENTO].[extensão]
 * Ex.: A7B92K1_foto.jpg, A7B92K1_atestado.pdf, A7B92K1_ficha.jpg
 * O mesmo módulo é usado para gerar os nomes no backup e para ligar cada
 * arquivo ao aluno na restauração, então os dois lados nunca divergem.
 */

export const TIPOS_ARQUIVO_BACKUP = [
  { campo: "foto_path", tipo: "foto", rotulo: "Foto do aluno" },
  { campo: "doc_atestado_path", tipo: "atestado", rotulo: "Atestado médico" },
  { campo: "doc_residencia_path", tipo: "comprovante_residencia", rotulo: "Comprovante de residência" },
  { campo: "doc_matricula_path", tipo: "matricula_escolar", rotulo: "Comprovante de matrícula escolar" },
  { campo: "doc_identidade_path", tipo: "identidade", rotulo: "Documento de identidade" },
  { campo: "doc_ficha_path", tipo: "ficha", rotulo: "Ficha" },
] as const;

export type CampoArquivoBackup = (typeof TIPOS_ARQUIVO_BACKUP)[number]["campo"];
export type TipoArquivoBackup = (typeof TIPOS_ARQUIVO_BACKUP)[number]["tipo"];

const CODIGO = /^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{7}$/;

export function codigoMatriculaValido(codigo: string | null | undefined): codigo is string {
  return typeof codigo === "string" && CODIGO.test(codigo);
}

export function tipoDoCampo(campo: string): TipoArquivoBackup | null {
  return TIPOS_ARQUIVO_BACKUP.find((t) => t.campo === campo)?.tipo ?? null;
}

export function campoDoTipo(tipo: string): CampoArquivoBackup | null {
  return TIPOS_ARQUIVO_BACKUP.find((t) => t.tipo === tipo)?.campo ?? null;
}

/** Extensão em minúsculas a partir do caminho salvo (padrão "jpg"). */
export function extensaoArquivo(caminho: string | null | undefined): string {
  const ultimo = (caminho ?? "").split("/").pop() ?? "";
  const partes = ultimo.split(".");
  const ext = partes.length > 1 ? (partes.pop() ?? "").toLowerCase() : "";
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : "jpg";
}

/** Nome sem extensão (ex.: "A7B92K1_foto"), usado para achar a versão anterior no Drive. */
export function baseArquivoBackup(codigo: string, campo: string): string {
  const tipo = tipoDoCampo(campo);
  if (!tipo) throw new Error(`Tipo de arquivo desconhecido: ${campo}`);
  if (!codigoMatriculaValido(codigo)) throw new Error(`Código de matrícula inválido: ${codigo}`);
  return `${codigo}_${tipo}`;
}

export function nomeArquivoBackup(codigo: string, campo: string, caminho: string): string {
  return `${baseArquivoBackup(codigo, campo)}.${extensaoArquivo(caminho)}`;
}

/** Lê um nome de arquivo do Drive e devolve o código e o campo do aluno, ou null se fora do padrão. */
export function interpretarNomeArquivoBackup(
  nome: string,
): { codigo: string; tipo: TipoArquivoBackup; campo: CampoArquivoBackup; extensao: string } | null {
  const m = nome.trim().match(/^([A-Za-z0-9]{7})_([a-z_]+)\.([A-Za-z0-9]{1,5})$/);
  if (!m?.[1] || !m[2] || !m[3]) return null;
  const codigo = m[1].toUpperCase();
  if (!codigoMatriculaValido(codigo)) return null;
  const campo = campoDoTipo(m[2]);
  if (!campo) return null;
  return { codigo, tipo: m[2] as TipoArquivoBackup, campo, extensao: m[3].toLowerCase() };
}

/** Marcador do formato antigo ("Nome - Foto [a1b2c3d4-foto].jpg"), usado só para renomear arquivos antigos. */
export function marcadorAntigo(alunoId: string, campo: string): string {
  const tipo = campo === "foto_path" ? "foto" : campo.replace(/^doc_|_path$/g, "");
  return `[${alunoId.slice(0, 8)}-${tipo}]`;
}

export function tipoConteudoPorExtensao(ext: string): string {
  const e = ext.toLowerCase();
  if (e === "png") return "image/png";
  if (e === "pdf") return "application/pdf";
  if (e === "webp") return "image/webp";
  if (e === "gif") return "image/gif";
  return "image/jpeg";
}
