import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizarTexto } from "./formatacao";

function prefixoRede(rede: string) {
  if (rede === "Pública") return "escola_publica:";
  if (rede === "Privada") return "escola_privada:";
  throw new Error("Selecione a rede de ensino para adicionar uma escola.");
}

export async function lerEscolasPersonalizadas(rede: string): Promise<string[]> {
  const { data, error } = await supabase.from("configuracoes")
    .select("valor").like("chave", `${prefixoRede(rede)}%`).order("valor");
  if (error) throw error;
  return (data ?? []).map(({ valor }) => valor).filter(Boolean);
}

export async function salvarEscolaPersonalizada(rede: string, nome: string): Promise<string> {
  const valor = nome.trim();
  if (!valor) throw new Error("Informe o nome da escola.");
  const chave = `${prefixoRede(rede)}${encodeURIComponent(normalizarTexto(valor))}`;
  const { error } = await supabase.from("configuracoes")
    .upsert({ chave, valor }, { onConflict: "chave" });
  if (error) throw error;
  return valor;
}

export const escolasPersonalizadasOptions = (rede: string) => queryOptions({
  queryKey: ["escolas-personalizadas", rede],
  queryFn: () => lerEscolasPersonalizadas(rede),
});