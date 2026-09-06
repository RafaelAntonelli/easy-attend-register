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

/**
 * Tela de carregamento: imagem do Programa Esporte 360 seguida do vídeo da Arena Aquática.
 * O elemento <video> nunca é desmontado, apenas escondido, para não recarregar.
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
    if (visivel && mostrarVideo) void v.play().catch(() => undefined);
  }, [visivel, mostrarVideo]);

  return (
    <div
      aria-hidden={!visivel}
      className={`fixed inset-0 z-[90] flex items-center justify-center bg-[#0d2270] transition-opacity duration-300 ${
        visivel ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {!mostrarVideo ? (
        <img
          src={programaEsporte360.url}
          alt="Programa Esporte 360"
          className="h-full w-full object-cover"
        />
      ) : (
        <video
          ref={videoRef}
          src={abertura.url}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="max-h-full max-w-full object-contain"
        />
      )}
    </div>
  );
}
