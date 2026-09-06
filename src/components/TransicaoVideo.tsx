import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import abertura from "@/assets/abertura-video.asset.json";
import programaEsporte360 from "@/assets/programa-esporte-360.png.asset.json";

/** Tempo de exibição da imagem do Programa Esporte 360 antes do vídeo (ms). */
const TEMPO_IMAGEM = 2500;
/** Duração da tela de abertura ao abrir o app (ms). */
const TEMPO_VIDEO = 2200;
/** Tempo mínimo de exibição para o vídeo não "piscar" (ms). */
const MINIMO = 900;
/** Duração do crossfade entre imagem e vídeo (ms). */
const DURACAO_FADE = 600;

/**
 * Tela de carregamento: imagem do Programa Esporte 360 seguida do vídeo da Arena Aquática.
 * Imagem e vídeo ficam sempre montados em camadas sobrepostas; a transição é um
 * crossfade por opacidade, sem desmontar nada (evita recarregar o vídeo e barras
 * no PWA/Android). Ambos usam object-cover para cobrir 100% da tela em qualquer
 * resolução, mantendo o aspecto sem distorcer.
 */
export function TransicaoVideo() {
  const carregando = useRouterState({ select: (s) => s.status === "pending" || s.isLoading });
  const [visivel, setVisivel] = useState(true);
  const [mostrarVideo, setMostrarVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const abriu = useRef(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => {
      setMostrarVideo(true);
    }, TEMPO_IMAGEM);
    const t2 = window.setTimeout(() => {
      abriu.current = true;
      setVisivel(false);
    }, TEMPO_IMAGEM + TEMPO_VIDEO);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    if (!abriu.current) return;
    if (carregando) {
      setVisivel(true);
      setMostrarVideo(true);
      return;
    }
    const t = window.setTimeout(() => setVisivel(false), MINIMO);
    return () => window.clearTimeout(t);
  }, [carregando]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (visivel) void v.play().catch(() => undefined);
  }, [visivel]);

  return (
    <div
      aria-hidden={!visivel}
      className={`fixed inset-0 z-[90] overflow-hidden bg-[#0d2270] transition-opacity duration-500 ease-out ${
        visivel ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {/* Vídeo em camada de fundo, sempre montado e já carregando para não atrasar o fade */}
      <video
        ref={videoRef}
        src={abertura.url}
        autoPlay
        muted
        loop
        playsInline
        // @ts-expect-error atributo legado para iOS antigo
        webkit-playsinline="true"
        preload="auto"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Imagem por cima, com crossfade de saída quando o vídeo assume */}
      <img
        src={programaEsporte360.url}
        alt="Programa Esporte 360"
        fetchPriority="high"
        draggable={false}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity ease-in-out ${
          mostrarVideo ? "opacity-0" : "opacity-100"
        }`}
        style={{ transitionDuration: `${DURACAO_FADE}ms` }}
      />
    </div>
  );
}
