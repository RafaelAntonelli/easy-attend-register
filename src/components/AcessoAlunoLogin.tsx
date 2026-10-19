import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LogIn, Smartphone } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { entradaAparelhoSchema } from "@/lib/portal-aluno";
import { entrarAparelho, prepararAparelho } from "@/lib/aparelho-aluno.functions";
import { salvarTokenAparelho, tokenAparelhoLocal } from "@/lib/aparelho-local";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { QRCodeSVG } from "qrcode.react";
import { gerarQrAparelho } from "@/lib/aparelho-qr";

export function AcessoAlunoLogin({ offline }: { offline: boolean }) {
  const [identificador, setIdentificador] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [aparelho, setAparelho] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [lembrar, setLembrar] = useState(false);
  useEffect(() => { try { const salvo = JSON.parse(localStorage.getItem('arena-login-aluno') ?? 'null'); if (salvo && typeof salvo.identificador === 'string' && typeof salvo.nascimento === 'string') {setIdentificador(salvo.identificador); setNascimento(salvo.nascimento);setLembrar(true);} } catch { /* storage unavailable */ } }, []);
  const entrarFn = useServerFn(entrarAparelho), preparar = useServerFn(prepararAparelho);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  async function entrar(e: React.FormEvent) {
    e.preventDefault(); setErro("");
    const validado = entradaAparelhoSchema.safeParse({ identificador, nascimento, aparelho: tokenAparelhoLocal() });
    if (!validado.success) { setErro(validado.error.issues[0]?.message ?? "Confira os dados."); return; }
    setBusy(true);
    try {
      const { token } = await entrarFn({ data: validado.data });
      const { error } = await supabase.auth.verifyOtp({ token_hash: token, type: "magiclink" });
      if (error) throw new Error("Não foi possível entrar. Tente novamente.");
      try { if(lembrar) { localStorage.setItem('arena-consentimento','permitido');localStorage.setItem('arena-login-aluno',JSON.stringify({identificador: validado.data.identificador,nascimento})); } else localStorage.removeItem('arena-login-aluno'); } catch { /* login still works without storage */ }
      await queryClient.cancelQueries(); queryClient.clear();
      await navigate({ to: "/area-aluno" });
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível entrar."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={entrar} className="space-y-4 text-left">
    <div className="space-y-2"><Label htmlFor="matricula-aluno">CPF ou matrícula</Label><Input id="matricula-aluno" value={identificador} maxLength={14} autoComplete="username" autoCapitalize="characters" spellCheck={false} onChange={e => setIdentificador(e.target.value.toUpperCase())} required /></div>
    <div className="space-y-2"><Label htmlFor="nascimento-aluno">Data de nascimento</Label><Input id="nascimento-aluno" type="date" value={nascimento} onChange={e => setNascimento(e.target.value)} required /></div>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    <label className="flex items-start gap-2 text-sm"><Checkbox checked={lembrar} onCheckedChange={v=>{setLembrar(v===true);if(v!==true)try{localStorage.removeItem('arena-login-aluno');}catch{}}} /><span>Salvar login neste aparelho<span className="block text-xs text-muted-foreground">Guarda CPF/matrícula e nascimento. Use somente em aparelho pessoal.</span></span></label>
    <Button type="submit" className="w-full" disabled={busy || offline}><LogIn className="mr-2 size-4" />{busy ? "Aguarde…" : "Entrar como aluno"}</Button>
    <Button type="button" variant="outline" className="w-full" disabled={busy || offline} onClick={async () => { setErro(""); setAparelho(null); const dados = entradaAparelhoSchema.omit({ aparelho: true }).safeParse({ identificador, nascimento }); if (!dados.success) { setErro("Preencha CPF ou matrícula e a data de nascimento para solicitar a liberação."); return; } setBusy(true); try { const a = await preparar({ data: { aparelho: tokenAparelhoLocal(), dados: dados.data } }); if (a.token) salvarTokenAparelho(a.token); setAparelho(a.aprovado ? "Aparelho já liberado" : a.codigo); } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao preparar aparelho."); } finally { setBusy(false); } }}><Smartphone className="mr-2 size-4" />Solicitar liberação deste aparelho</Button>
    {aparelho && <div className="space-y-3 border-t border-border pt-3 text-center">{aparelho === "Aparelho já liberado" ? <p className="text-sm font-semibold" role="status">Aparelho já liberado</p> : <><p className="text-sm font-medium">Liberação presencial do aparelho</p><QRCodeSVG value={gerarQrAparelho(aparelho)} size={208} marginSize={4} level="M" className="mx-auto max-w-full" title="QR Code para liberação deste aparelho" /><p className="text-xs text-muted-foreground">Apresente este QR Code à equipe.</p></>}</div>}
  </form>;
}
