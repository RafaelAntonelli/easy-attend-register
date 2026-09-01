import { useEffect, useState } from "react";

import seculje from "@/assets/seculje.png.asset.json";
import esporte360 from "@/assets/esporte360.png.asset.json";

const TELAS = [
  { url: seculje.url, alt: "SECULJE — Secretaria de Esporte, Saber, Juventude e Esports de Lauro de Freitas" },
  { url: esporte360.url, alt: "Programa Esporte 360" },
];

/** Tempo de exibição de cada imagem (ms), incluindo a transição. */
const DURACAO = 1900;
const CHAVE = "arena:abertura-vista";

/** Tela de abertura: exibe a SECULJE e depois o Esporte 360 com transição suave. */
export function AberturaApp() {
  const [visivel, setVisivel] = useState(() => {
    if (typeof sessionStorage === "undefined") return false;
    return sessionStorage.getItem(CHAVE) !== "1";
  });
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    if (!visivel) return;
    const proxima = window.setTimeout(() => {
      if (indice < TELAS.length - 1) setIndice((i) => i + 1);
      else {
        sessionStorage.setItem(CHAVE, "1");
        setVisivel(false);
      }
    }, DURACAO);
    return () => window.clearTimeout(proxima);
  }, [indice, visivel]);

  if (!visivel) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[#0d2270]">
      {TELAS.map((tela, i) => (
        <img
          key={tela.url}
          src={tela.url}
          alt={tela.alt}
          className={`absolute inset-0 size-full object-cover transition-all duration-700 ease-out ${
            i === indice ? "scale-100 opacity-100" : "scale-105 opacity-0"
          }`}
        />
      ))}
    </div>
  );
}
