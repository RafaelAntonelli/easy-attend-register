import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ScanText, Loader2 } from "lucide-react";
import { assistenciaIA } from "@/lib/ai.functions";
import { CAMPOS_FICHA, camposFichaRevisados, type DadosFicha } from "@/lib/ai-contract";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LeitorFicha({ arquivo, editando, permitido, onAplicar }: { arquivo: File | null; editando: boolean; permitido: boolean; onAplicar: (dados: DadosFicha) => void }) {
  const chamar = useServerFn(assistenciaIA);
  const [dados, setDados] = useState<DadosFicha | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function ler() {
    if (!arquivo || !permitido || ocupado) return;
    if (arquivo.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(arquivo.type)) { setErro("Escolha uma foto JPG, PNG ou WebP de até 5 MB."); return; }
    setOcupado(true); setErro(""); setDados(null);
    try {
      const imagem = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(arquivo); });
      const r = await chamar({ data: { acao: "ficha", imagem, editando } });
      if (!r.ok) setErro(r.erro);
      else if ("ficha" in r) { setDados(camposFichaRevisados(r.ficha.campos)); setAvisos(r.ficha.avisos); }
    } catch { setErro("Não foi possível ler a ficha. Verifique sua conexão."); } finally { setOcupado(false); }
  }
  return <section className="space-y-3 border-b border-border pb-4" aria-label="Leitura da ficha">
    <Button type="button" variant="outline" size="sm" disabled={!arquivo || !permitido || ocupado} onClick={() => void ler()}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : <ScanText className="size-4" />}{ocupado ? "Lendo ficha…" : "Ler ficha com IA"}</Button>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    {dados && <div className="space-y-3">
      <h3 className="text-sm font-semibold">Revisar dados da ficha</h3>
      {avisos.map((a, i) => <p key={i} className="text-sm text-muted-foreground">{a}</p>)}
      <div className="grid gap-3 sm:grid-cols-2">{CAMPOS_FICHA.filter(([c]) => c in dados).map(([c, label]) => <div key={c} className="space-y-1"><Label htmlFor={`ia-${c}`}>{label}</Label><Input id={`ia-${c}`} value={dados[c] ?? ""} onChange={(e) => setDados({ ...dados, [c]: e.target.value })} /></div>)}</div>
      <Button type="button" disabled={!arquivo || !permitido} onClick={() => { if (arquivo) { onAplicar(dados); setDados(null); } }}>Aplicar dados revisados</Button>
    </div>}
  </section>;
}