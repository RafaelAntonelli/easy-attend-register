/**
 * Reduz e comprime imagens no próprio aparelho antes do envio ou da leitura por IA.
 * PDFs e outros arquivos que não são foto passam sem alteração.
 */

export const LADO_MAXIMO_IMAGEM = 1600;
export const QUALIDADE_IMAGEM = 0.8;

/** Tamanho final mantendo a proporção, sem nunca aumentar a imagem. */
export function dimensoesReduzidas(largura: number, altura: number, ladoMaximo = LADO_MAXIMO_IMAGEM) {
  const maior = Math.max(largura, altura);
  if (!(maior > ladoMaximo)) return { largura, altura };
  const fator = ladoMaximo / maior;
  return { largura: Math.max(1, Math.round(largura * fator)), altura: Math.max(1, Math.round(altura * fator)) };
}

const TIPOS_COMPRIMIVEIS = /^image\/(jpeg|jpg|png|webp|heic|heif|bmp)$/i;

export function imagemComprimivel(tipo: string | null | undefined) {
  return TIPOS_COMPRIMIVEIS.test(tipo ?? "");
}

async function carregar(arquivo: Blob): Promise<{ fonte: CanvasImageSource; largura: number; altura: number; liberar: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
      return { fonte: bmp, largura: bmp.width, altura: bmp.height, liberar: () => bmp.close() };
    } catch {
      /* tenta pelo elemento <img> */
    }
  }
  const url = URL.createObjectURL(arquivo);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
  await img.decode();
  return { fonte: img, largura: img.naturalWidth, altura: img.naturalHeight, liberar: () => URL.revokeObjectURL(url) };
}

function nomeJpg(nome: string) {
  const base = nome.replace(/\.[^./\\]+$/, "") || "imagem";
  return `${base}.jpg`;
}

/**
 * Devolve a imagem com no máximo 1600 px no lado maior e cerca de 80% de qualidade (JPEG).
 * Se não for imagem, se o navegador não conseguir ler, ou se o resultado ficar maior,
 * devolve o arquivo original.
 */
export async function otimizarImagem(
  arquivo: File,
  opcoes: { ladoMaximo?: number; qualidade?: number } = {},
): Promise<File> {
  if (typeof document === "undefined" || !imagemComprimivel(arquivo.type)) return arquivo;
  const ladoMaximo = opcoes.ladoMaximo ?? LADO_MAXIMO_IMAGEM;
  const qualidade = opcoes.qualidade ?? QUALIDADE_IMAGEM;
  let imagem: Awaited<ReturnType<typeof carregar>> | null = null;
  try {
    imagem = await carregar(arquivo);
    const { largura, altura } = dimensoesReduzidas(imagem.largura, imagem.altura, ladoMaximo);
    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) return arquivo;
    // Fundo branco: PNG com transparência vira JPEG sem áreas pretas.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, largura, altura);
    ctx.drawImage(imagem.fonte, 0, 0, largura, altura);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", qualidade));
    if (!blob) return arquivo;
    const reduziu = largura < imagem.largura || altura < imagem.altura;
    if (!reduziu && blob.size >= arquivo.size && /jpe?g/i.test(arquivo.type)) return arquivo;
    return new File([blob], nomeJpg(arquivo.name), { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return arquivo;
  } finally {
    imagem?.liberar();
  }
}

/** Mesma otimização para um Blob sem nome (ex.: imagens importadas de planilha). */
export async function otimizarBlobImagem(blob: Blob, nome = "imagem.jpg"): Promise<Blob> {
  if (!imagemComprimivel(blob.type)) return blob;
  return await otimizarImagem(new File([blob], nome, { type: blob.type }));
}
