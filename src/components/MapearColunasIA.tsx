import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2 } from "lucide-react";
import { assistenciaIA } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function MapearColunasIA({ origens, destinos, modo, permitido, onAplicar }: { origens: string[]; destinos: readonly string[]; modo: "criar" | "atualizar"; permitido: boolean; onAplicar: (mapa: Record<string, string>) => void }) {
  const chamar = useServerFn(assistenciaIA); const [mapa, setMapa] = useState<Record<string, string> | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]); const [erro, setErro] = useState(""); const [ocupado, setOcupado] = useState(false);
  async function sugerir() {
    if (!permitido || ocupado) return;
    setOcupado(true); setErro("");
    try { const r = await chamar({ data: { acao: "colunas", origens, destinos: [...destinos], modo } }); if (!r.ok) setErro(r.erro); else if ("colunas" in r) { setMapa(r.colunas.mapa); setAvisos(r.colunas.avisos); } }
    catch { setErro("Não foi possível reconhecer as colunas. Verifique sua conexão."); } finally { setOcupado(false); }
  }
  return <section className="space-y-3 border-y border-border py-3" aria-label="Correspondência de colunas">
    <Button type="button" size="sm" variant="outline" disabled={!permitido || ocupado} onClick={() => void sugerir()}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{ocupado ? "Analisando colunas…" : "Sugerir colunas com IA"}</Button>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {mapa && <><h3 className="text-sm font-semibold">Revisar correspondências</h3>{avisos.map((a, i) => <p key={i} className="text-sm text-muted-foreground">{a}</p>)}
      <div className="grid gap-3 sm:grid-cols-2">{destinos.map((d) => <div key={d} className="min-w-0 space-y-1"><Label>{d}</Label><Select value={mapa[d] || "__ignorar"} onValueChange={(v) => setMapa({ ...mapa, [d]: v === "__ignorar" ? "" : v })}><SelectTrigger aria-label={`Coluna para ${d}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__ignorar">Não importar</SelectItem>{origens.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>)}</div>
      <Button type="button" disabled={!permitido} onClick={() => { onAplicar(mapa); setMapa(null); }}>Aplicar correspondências revisadas</Button></>}
  </section>;
}