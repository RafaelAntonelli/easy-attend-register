import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import abertura from "@/assets/abertura-video.asset.json";

/** Tempo mínimo de exibição para o vídeo não "piscar" (ms). */
const MINIMO = 900;

/** Tela de carregamento entre telas: vídeo em tela cheia enquanto a rota carrega. */
export function TransicaoVideo() {
  const carregando = useRouterState({ select: (s) => s.status === "pending" || s.isLoading });
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    if (carregando) {
      setVisivel(true);
      return;
    }
    const t = window.setTimeout(() => setVisivel(false), MINIMO);
    return () => window.clearTimeout(t);
  }, [carregando]);

  if (!visivel) return null;

  return (
    <div className="fixed inset-0 z-[90] bg-[#0d2270] animate-fade-in">
      <video
        src={abertura.url}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="size-full object-cover"
      />
    </div>
  );
}
