import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Converte links de compartilhamento (Drive, Dropbox, OneDrive) em link direto da imagem. */
export function linkDiretoImagem(url: string) {
  const drive =
    url.match(/drive\.google\.com\/file\/d\/([\w-]+)/) ?? url.match(/drive\.google\.com\/open\?id=([\w-]+)/);
  if (drive?.[1]) return `https://drive.google.com/uc?export=download&id=${drive[1]}`;
  if (/dropbox\.com/.test(url)) return url.replace(/[?&]dl=0/, "").concat(url.includes("?") ? "&raw=1" : "?raw=1");
  return url;
}

/**
 * Baixa a imagem no servidor (o navegador bloqueia por CORS) e devolve em base64.
 */
export const baixarImagem = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ url: z.string().url() }).parse(data))
  .handler(async ({ data }) => {
    const alvo = linkDiretoImagem(data.url);
    if (!/^https?:\/\//i.test(alvo)) throw new Error("Link inválido");

    const resp = await fetch(alvo, { headers: { "User-Agent": "Mozilla/5.0", Accept: "image/*,*/*" } });
    if (!resp.ok) throw new Error(`Não foi possível baixar a imagem (HTTP ${resp.status})`);

    const contentType = resp.headers.get("content-type") ?? "";
    const buffer = await resp.arrayBuffer();
    if (buffer.byteLength > 8 * 1024 * 1024) throw new Error("Imagem maior que 8MB");

    const bytes = new Uint8Array(buffer);
    const assinaturaImagem =
      (bytes[0] === 0xff && bytes[1] === 0xd8) || // jpg
      (bytes[0] === 0x89 && bytes[1] === 0x50) || // png
      (bytes[0] === 0x47 && bytes[1] === 0x49) || // gif
      (bytes[0] === 0x52 && bytes[1] === 0x49); // webp
    if (!contentType.startsWith("image/") && !assinaturaImagem)
      throw new Error("O link não aponta para uma imagem (verifique se o arquivo é público)");

    let binario = "";
    for (let i = 0; i < bytes.length; i += 8192)
      binario += String.fromCharCode(...bytes.subarray(i, i + 8192));

    return {
      base64: btoa(binario),
      contentType: contentType.startsWith("image/") ? contentType : "image/jpeg",
    };
  });
