import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import aberturaSeculje from "@/assets/abertura-seculje.png.asset.json";
import aberturaEsporte360 from "@/assets/abertura-esporte-360.png.asset.json";

/** Tempo de exibição da primeira imagem (ms). */
const TEMPO_PRIMEIRA_IMAGEM = 2300;
/** Tempo de exibição da segunda imagem (ms). */
const TEMPO_SEGUNDA_IMAGEM = 2200;
/** Tempo mínimo de exibição durante uma troca de tela (ms). */
const MINIMO = 900;
/** Duração do crossfade entre imagem e vídeo (ms). */
const DURACAO_FADE = 600;

/**
 * Tela de carregamento com as duas imagens institucionais em sequência.
 * As imagens ficam montadas em camadas sobrepostas para um crossfade suave,
 * sem barras ou tela vazia no PWA e no Android.
 */
export function TransicaoVideo() {
  const carregando = useRouterState({ select: (s) => s.status === "pending" || s.isLoading });
  const [visivel, setVisivel] = useState(true);
  const [mostrarSegundaImagem, setMostrarSegundaImagem] = useState(false);
  const abriu = useRef(false);

  useEffect(() => {
    const t1 = window.setTimeout(
      () => setMostrarSegundaImagem(true),
      TEMPO_PRIMEIRA_IMAGEM,
    );
    const t2 = window.setTimeout(() => {
      abriu.current = true;
      setVisivel(false);
    }, TEMPO_PRIMEIRA_IMAGEM + TEMPO_SEGUNDA_IMAGEM);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    if (!abriu.current) return;
    if (carregando) {
      setVisivel(true);
      setMostrarSegundaImagem(true);
      return;
    }
    const t = window.setTimeout(() => setVisivel(false), MINIMO);
    return () => window.clearTimeout(t);
  }, [carregando]);

  return (
    <div
      aria-hidden={!visivel}
      className={`fixed inset-0 z-[90] overflow-hidden bg-primary transition-opacity duration-500 ease-out ${
        visivel ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <img
        src={aberturaEsporte360.url}
        alt="Programa Esporte 360"
        fetchPriority="high"
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <img
        src={aberturaSeculje.url}
        alt="SECULJE — Secretaria de Esporte, Saber, Juventude e Esports de Lauro de Freitas"
        fetchPriority="high"
        draggable={false}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity ease-in-out ${
          mostrarSegundaImagem ? "opacity-0" : "opacity-100"
        }`}
        style={{ transitionDuration: `${DURACAO_FADE}ms` }}
      />
    </div>
  );
}
