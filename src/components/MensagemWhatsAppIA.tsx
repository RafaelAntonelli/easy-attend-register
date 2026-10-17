import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, MessageCircle, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { assistenciaIA } from "@/lib/ai.functions";
import { linkConversaWhatsApp } from "@/lib/whatsapp";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function MensagemWhatsAppIA({ telefone }: { telefone: string | null | undefined }) {
  const chamar = useServerFn(assistenciaIA); const { isStaff, loading } = useAuth();
  const [assunto, setAssunto] = useState<"documentos" | "vaga" | "retorno">("documentos");
  const [data, setData] = useState(""); const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState(""); const [ocupado, setOcupado] = useState(false);
  const link = linkConversaWhatsApp(telefone, mensagem);
  async function gerar() {
    if (!isStaff || ocupado) return;
    setOcupado(true); setErro("");
    try { const r = await chamar({ data: { acao: "mensagem", assunto, data } }); if (!r.ok) setErro(r.erro); else if ("texto" in r) setMensagem(r.texto); }
    catch { setErro("Não foi possível preparar a mensagem. Verifique sua conexão."); } finally { setOcupado(false); }
  }
  return <Dialog><DialogTrigger asChild><Button type="button" size="sm" variant="outline" disabled={loading || !isStaff}><Sparkles className="size-4" /> Preparar mensagem</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Mensagem para WhatsApp</DialogTitle><DialogDescription>Rascunho para revisão · Nenhuma mensagem enviada</DialogDescription></DialogHeader>
      <Label>Assunto</Label><Select value={assunto} onValueChange={(v) => { setAssunto(v as typeof assunto); setMensagem(""); }}><SelectTrigger aria-label="Assunto da mensagem"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="documentos">Documentos pendentes</SelectItem><SelectItem value="vaga">Possível vaga</SelectItem><SelectItem value="retorno">Retorno de licença</SelectItem></SelectContent></Select>
      {assunto === "retorno" && <div className="space-y-1"><Label htmlFor="ia-retorno">Data prevista (opcional)</Label><Input id="ia-retorno" type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>}
      <Button type="button" variant="outline" onClick={() => void gerar()} disabled={ocupado}>{ocupado ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{ocupado ? "Preparando…" : "Gerar rascunho com IA"}</Button>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <Label htmlFor="rascunho-whatsapp">Mensagem revisada</Label><Textarea id="rascunho-whatsapp" rows={6} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
      <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!mensagem.trim()} onClick={async () => { try { await navigator.clipboard.writeText(mensagem); toast.success("Mensagem copiada."); } catch { toast.error("Não foi possível copiar."); } }}><Copy className="size-4" /> Copiar</Button>
      {link && mensagem.trim() ? <Button asChild><a href={link} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" /> Abrir WhatsApp</a></Button> : <Button disabled><MessageCircle className="size-4" /> Abrir WhatsApp</Button>}</div>
    </DialogContent>
  </Dialog>;
}