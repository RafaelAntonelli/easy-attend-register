import jsPDF from "jspdf";
import QRCode from "qrcode";
import modeloCracha from "@/assets/cracha-modelo.jpg";

// Cartão CR-80 (padrão de crachá): 85,6 x 54 mm
export const CR80 = { largura: 85.6, altura: 54 };

// A arte modelo tem 1920 x 1210 px e a mesma proporção do CR-80
const ARTE = { largura: 1920, altura: 1209 };
const EX = CR80.largura / ARTE.largura;
const EY = CR80.altura / ARTE.altura;

const mmX = (px: number) => px * EX;
const mmY = (px: number) => px * EY;

export type DadosCracha = {
  nome: string;
  rg: string | null;
  cpf: string | null;
  responsavel: string | null;
  telefone: string | null;
  pcd: boolean;
  modalidade: string | null;
  horario: string | null;
  dias: string[] | null;
  fotoUrl?: string | null;
  codigo?: string | null;
};

// Valores desenhados na faixa cinza ABAIXO de cada rótulo, alinhados à esquerda do rótulo
// (coordenadas em px da arte 1920x1209, medidas sobre o modelo)
const CAMPOS = {
  nome: { x: 526, y: 312, w: 890, pt: 13 },
  pcd: { x: 1474, y: 312, w: 350, pt: 13 },
  documento: { x: 526, y: 498, w: 1300, pt: 11 },
  responsavel: { x: 526, y: 650, w: 1300, pt: 11 },
  celular: { x: 526, y: 807, w: 700, pt: 11 },
  modalidade: { x: 1269, y: 807, w: 555, pt: 11 },
  horario: { x: 526, y: 974, w: 700, pt: 11 },
  dias: { x: 1269, y: 974, w: 555, pt: 10.5 },
} as const;

const FOTO = { x: 32, y: 158, w: 436, h: 605 };
const QR = { x: 145, y: 800, size: 210 };


async function urlParaDataUrl(url: string) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const blob = await resp.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Falha ao ler imagem"));
    reader.readAsDataURL(blob);
  });
}

let modeloCache: string | null = null;
async function obterModelo() {
  if (!modeloCache) modeloCache = await urlParaDataUrl(modeloUrl());
  return modeloCache;
}
function modeloUrl() {
  return modeloCracha as unknown as string;
}

async function qrDataUrl(texto: string) {
  return await QRCode.toDataURL(texto, { margin: 1, width: 400, errorCorrectionLevel: "M" });
}

function textoAjustado(doc: jsPDF, texto: string, larguraMm: number, tamanhoBase = 9) {
  let tamanho = tamanhoBase;
  doc.setFontSize(tamanho);
  while (tamanho > 5 && doc.getTextWidth(texto) > larguraMm) {
    tamanho -= 0.5;
    doc.setFontSize(tamanho);
  }
  return tamanho;
}

function escrever(doc: jsPDF, campo: { x: number; y: number; w: number }, texto: string, tamanhoBase = 9) {
  if (!texto) return;
  textoAjustado(doc, texto, mmX(campo.w), tamanhoBase);
  doc.text(texto, mmX(campo.x), mmY(campo.y), { baseline: "middle" });
}

function documentoFormatado(d: DadosCracha) {
  return [d.rg, d.cpf].filter(Boolean).join("  /  ");
}

async function desenharCracha(doc: jsPDF, dados: DadosCracha, modelo: string, ox = 0, oy = 0) {
  doc.addImage(modelo, "JPEG", ox, oy, CR80.largura, CR80.altura);

  if (dados.fotoUrl) {
    try {
      const foto = await urlParaDataUrl(dados.fotoUrl);
      doc.addImage(foto, ox + mmX(FOTO.x), oy + mmY(FOTO.y), mmX(FOTO.w), mmY(FOTO.h), undefined, "FAST");
    } catch {
      // segue sem foto
    }
  }

  if (dados.codigo) {
    try {
      const qr = await qrDataUrl(dados.codigo);
      doc.setFillColor(255, 255, 255);
      doc.rect(ox + mmX(QR.x) - 1, oy + mmY(QR.y) - 1, mmX(QR.size) + 2, mmY(QR.size) + 2, "F");
      doc.addImage(qr, "PNG", ox + mmX(QR.x), oy + mmY(QR.y), mmX(QR.size), mmY(QR.size), undefined, "FAST");
    } catch {
      // segue sem QR
    }
  }

  doc.setTextColor(20, 20, 40);
  doc.setFont("helvetica", "bold");

  const put = (campo: { x: number; y: number; w: number }, texto: string, base = 9) => {
    if (!texto) return;
    textoAjustado(doc, texto, mmX(campo.w), base);
    doc.text(texto, ox + mmX(campo.x), oy + mmY(campo.y), { baseline: "middle" });
  };

  put(CAMPOS.nome, dados.nome ?? "");
  put(CAMPOS.pcd, dados.pcd ? "Sim" : "Não");
  put(CAMPOS.documento, documentoFormatado(dados));
  put(CAMPOS.responsavel, dados.responsavel ?? "");
  put(CAMPOS.celular, dados.telefone ?? "");
  put(CAMPOS.modalidade, dados.modalidade ?? "");
  put(CAMPOS.horario, dados.horario ?? "");
  put(CAMPOS.dias, (dados.dias ?? []).join(" e "), 8);
}

// Um crachá por página, no tamanho exato CR-80 (impressoras de cartão)
export async function gerarCrachasPdf(lista: DadosCracha[], nomeArquivo: string) {
  if (!lista.length) throw new Error("Nenhum aluno selecionado");
  const modelo = await obterModelo();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [CR80.largura, CR80.altura] });

  for (let i = 0; i < lista.length; i++) {
    if (i > 0) doc.addPage([CR80.largura, CR80.altura], "landscape");
    await desenharCracha(doc, lista[i]!, modelo);
  }

  doc.save(nomeArquivo.endsWith(".pdf") ? nomeArquivo : `${nomeArquivo}.pdf`);
}

// Folha A4 com vários crachás (2 colunas x 5 linhas) para recorte
export async function gerarFolhaA4Crachas(lista: DadosCracha[], nomeArquivo: string) {
  if (!lista.length) throw new Error("Nenhum aluno selecionado");
  const modelo = await obterModelo();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const colunas = 2;
  const linhas = 5;
  const margemX = 10;
  const margemY = 8;
  const espacoX = 5;
  const espacoY = 3;
  const porPagina = colunas * linhas;

  for (let i = 0; i < lista.length; i++) {
    const indice = i % porPagina;
    if (i > 0 && indice === 0) doc.addPage();
    const col = indice % colunas;
    const lin = Math.floor(indice / colunas);
    const ox = margemX + col * (CR80.largura + espacoX);
    const oy = margemY + lin * (CR80.altura + espacoY);
    await desenharCracha(doc, lista[i]!, modelo, ox, oy);
    doc.setDrawColor(200);
    doc.rect(ox, oy, CR80.largura, CR80.altura);
  }

  doc.save(nomeArquivo.endsWith(".pdf") ? nomeArquivo : `${nomeArquivo}.pdf`);
}

// Gera um PDF de um único crachá e devolve uma URL de blob para pré-visualização
export async function gerarCrachaPreviewUrl(dados: DadosCracha) {
  const modelo = await obterModelo();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [CR80.largura, CR80.altura] });
  await desenharCracha(doc, dados, modelo);
  return doc.output("bloburl").toString();
}

// ---- Pré-visualização em imagem (PNG) — mais confiável que embutir PDF em iframe ----
function carregarImagem(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar imagem"));
    img.src = src;
  });
}

const PX_POR_MM = ARTE.altura / CR80.altura;

export async function gerarCrachaPreviewImagem(dados: DadosCracha) {
  const canvas = document.createElement("canvas");
  canvas.width = ARTE.largura;
  canvas.height = ARTE.altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");

  const modelo = await carregarImagem(await obterModelo());
  ctx.drawImage(modelo, 0, 0, ARTE.largura, ARTE.altura);

  if (dados.fotoUrl) {
    try {
      const foto = await carregarImagem(await urlParaDataUrl(dados.fotoUrl));
      ctx.drawImage(foto, FOTO.x, FOTO.y, FOTO.w, FOTO.h);
    } catch {
      // segue sem foto
    }
  }

  if (dados.codigo) {
    try {
      const qr = await carregarImagem(await qrDataUrl(dados.codigo));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(QR.x - 8, QR.y - 8, QR.size + 16, QR.size + 16);
      ctx.drawImage(qr, QR.x, QR.y, QR.size, QR.size);
    } catch {
      // segue sem QR
    }
  }

  ctx.fillStyle = "#141428";
  ctx.textBaseline = "middle";

  const put = (campo: { x: number; y: number; w: number }, texto: string, base = 9) => {
    if (!texto) return;
    let tamanhoPt = base;
    const aplicar = () => {
      ctx.font = `bold ${(tamanhoPt * 0.3528 * PX_POR_MM).toFixed(1)}px Helvetica, Arial, sans-serif`;
    };
    aplicar();
    while (tamanhoPt > 5 && ctx.measureText(texto).width > campo.w) {
      tamanhoPt -= 0.5;
      aplicar();
    }
    ctx.fillText(texto, campo.x, campo.y);
  };

  put(CAMPOS.nome, dados.nome ?? "");
  put(CAMPOS.pcd, dados.pcd ? "Sim" : "Não");
  put(CAMPOS.documento, documentoFormatado(dados));
  put(CAMPOS.responsavel, dados.responsavel ?? "");
  put(CAMPOS.celular, dados.telefone ?? "");
  put(CAMPOS.modalidade, dados.modalidade ?? "");
  put(CAMPOS.horario, dados.horario ?? "");
  put(CAMPOS.dias, (dados.dias ?? []).join(" e "), 8);

  return canvas.toDataURL("image/png");
}
