import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, LogIn, WifiOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { emailContaAluno, loginAlunoSchema } from "@/lib/portal-aluno";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AcessoAlunoLogin({ offline }: { offline: boolean }) {
  const [codigo, setCodigo] = useState("");
  const [senha, setSenha] = useState("");
  const [ver, setVer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  async function entrar(e: React.FormEvent) {
    e.preventDefault(); setErro("");
    const validado = loginAlunoSchema.safeParse({ codigo, senha });
    if (!validado.success) { setErro(validado.error.issues[0]?.message ?? "Confira os dados."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: emailContaAluno(validado.data.codigo), password: validado.data.senha });
      if (error) { setErro(error.status === 429 ? "Muitas tentativas. Aguarde alguns minutos." : "Matrícula ou senha incorreta, ou acesso ainda não liberado."); return; }
      await queryClient.cancelQueries(); queryClient.clear(); setSenha("");
      await navigate({ to: "/area-aluno" });
    } catch { setErro("Não foi possível entrar. Verifique sua conexão."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={entrar} className="space-y-4 text-left">
    {offline && <p className="flex items-center gap-2 text-sm text-destructive"><WifiOff className="size-4" />Você está sem internet.</p>}
    <div className="space-y-2"><Label htmlFor="matricula-aluno">Matrícula</Label><Input id="matricula-aluno" value={codigo} maxLength={7} autoComplete="username" autoCapitalize="characters" spellCheck={false} onChange={e => setCodigo(e.target.value.toUpperCase())} required /></div>
    <div className="space-y-2"><Label htmlFor="senha-aluno">Senha</Label><div className="relative"><Input id="senha-aluno" type={ver ? "text" : "password"} value={senha} maxLength={128} autoComplete="current-password" className="pr-12" onChange={e => setSenha(e.target.value)} required /><Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0" aria-label={ver ? "Esconder senha do aluno" : "Mostrar senha do aluno"} onClick={() => setVer(!ver)}>{ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button></div></div>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
    <Button type="submit" className="w-full" disabled={busy || offline}><LogIn className="mr-2 size-4" />{busy ? "Entrando…" : "Entrar como aluno"}</Button>
    <p className="text-center text-xs text-muted-foreground">Primeiro acesso ou esqueceu a senha? Procure a equipe para liberar ou recuperar seu acesso.</p>
  </form>;
}