import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import abertura from "@/assets/abertura-video.asset.json";

/** Tempo mínimo de exibição para o vídeo não "piscar" (ms). */
const MINIMO = 900;
/** Duração da tela de abertura ao abrir o app (ms). */
const ABERTURA = 2200;

/**
 * Tela de carregamento: vídeo em tela cheia ao abrir o app e entre navegações.
 * O elemento <video> nunca é desmontado, apenas escondido, para não recarregar.
 */
export function TransicaoVideo() {
  const carregando = useRouterState({ select: (s) => s.status === "pending" || s.isLoading });
  const [visivel, setVisivel] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const abriu = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      abriu.current = true;
      setVisivel(false);
    }, ABERTURA);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!abriu.current) return;
    if (carregando) {
      setVisivel(true);
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
      className={`fixed inset-0 z-[90] flex items-center justify-center bg-[#0d2270] transition-opacity duration-300 ${
        visivel ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
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
    </div>
  );
}
