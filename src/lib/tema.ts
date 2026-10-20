import { useEffect, useState } from "react";

/** Preferência de tema (claro/escuro) guardada no aparelho. */
export const CHAVE_TEMA = "arena-tema";

/** Roda antes da página aparecer, evitando o "piscar" do tema claro. */
export const SCRIPT_TEMA_INICIAL = `try{if(localStorage.getItem("${CHAVE_TEMA}")==="escuro")document.documentElement.classList.add("dark")}catch(e){}`;

export function useTema() {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    setEscuro(document.documentElement.classList.contains("dark"));
  }, []);

  function alternar() {
    const novo = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", novo);
    try {
      localStorage.setItem(CHAVE_TEMA, novo ? "escuro" : "claro");
    } catch {
      /* armazenamento indisponível: vale só nesta visita */
    }
    setEscuro(novo);
  }

  return { escuro, alternar };
}
