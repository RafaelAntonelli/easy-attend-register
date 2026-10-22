import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Eye, EyeOff, ImagePlus, KeyRound, Phone, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { obterMeuPerfil, salvarFotoEquipe, salvarTelefoneEquipe } from "@/lib/meu-perfil.functions";
import { otimizarImagem } from "@/lib/imagem";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/meu-perfil")({
  head: () => ({
    meta: [
      { title: "Meu perfil | Arena Aquática LF" },
      { name: "description", content: "Foto, telefone e senha do membro da equipe da Arena Aquática LF." },
      { property: "og:title", content: "Meu perfil | Arena Aquática LF" },
      { property: "og:description", content: "Dados pessoais de acesso da equipe da Arena Aquática LF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: MeuPerfilPage,
});

const SENHA_MINIMA = 8;

function MeuPerfilPage() {
  return (
    <AppShell title="Meu perfil" subtitle="Sua foto, telefone e senha de acesso">
      <MeuPerfil />
    </AppShell>
  );
}

function MeuPerfil() {
  const qc = useQueryClient();
  const { data: perfil, isError, isLoading } = useQuery({ queryKey: ["meu-perfil"], queryFn: () => obterMeuPerfil() });
  const [telefone, setTelefone] = useState<string | null>(null);
  const [busyFoto, setBusyFoto] = useState(false);
  const [busyTel, setBusyTel] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null), galeriaRef = useRef<HTMLInputElement>(null);

  if (isError) return <p role="alert" className="text-sm text-destructive">Não foi possível carregar seu perfil.</p>;
  if (isLoading || !perfil) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  const tel = telefone ?? perfil.telefone;

  async function enviarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget, original = input.files?.[0];
    if (!original) return;
    setBusyFoto(true);
    try {
      const file = await otimizarImagem(original);
      const tipo = file.type;
      if (file.size > 5 * 1024 * 1024) throw new Error("Use uma foto de até 5 MB.");
      if (tipo !== "image/jpeg" && tipo !== "image/png" && tipo !== "image/webp") throw new Error("Use uma foto JPG, PNG ou WebP.");
      const base64 = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(",")[1] ?? ""); r.onerror = () => reject(new Error("Não foi possível ler a foto.")); r.readAsDataURL(file); });
      await salvarFotoEquipe({ data: { tipo, base64 } });
      await qc.invalidateQueries({ queryKey: ["meu-perfil"] });
      toast.success("Foto atualizada.");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao enviar foto."); }
    finally { setBusyFoto(false); input.value = ""; }
  }

  return (
    <div className="grid max-w-5xl items-start gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="font-display text-lg">Foto e contato</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            {perfil.fotoUrl
              ? <img src={perfil.fotoUrl} alt={`Foto de ${perfil.nome || "você"}`} className="size-24 shrink-0 rounded-full object-cover ring-4 ring-secondary" />
              : <div className="flex size-24 shrink-0 items-center justify-center rounded-full bg-secondary"><UserRound className="size-10 text-secondary-foreground" /></div>}
            <div className="min-w-0">
              <p className="break-words font-display text-lg font-semibold">{perfil.nome || "Sem nome"}</p>
              <p className="break-all text-sm text-muted-foreground">{perfil.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busyFoto} onClick={() => cameraRef.current?.click()}><Camera className="mr-2 size-4" />Tirar foto</Button>
            <Button type="button" variant="outline" disabled={busyFoto} onClick={() => galeriaRef.current?.click()}><ImagePlus className="mr-2 size-4" />Escolher foto</Button>
            <input ref={cameraRef} className="hidden" aria-label="Foto pela câmera" type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={enviarFoto} />
            <input ref={galeriaRef} className="hidden" aria-label="Foto da galeria" type="file" accept="image/jpeg,image/png,image/webp" onChange={enviarFoto} />
          </div>
          {busyFoto && <p role="status" className="text-sm text-muted-foreground">Enviando foto…</p>}
          <form className="space-y-2 border-t border-border pt-5" onSubmit={async (e) => {
            e.preventDefault(); setBusyTel(true);
            try { await salvarTelefoneEquipe({ data: { telefone: tel } }); await qc.invalidateQueries({ queryKey: ["meu-perfil"] }); setTelefone(null); toast.success("Telefone salvo."); }
            catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao salvar."); }
            finally { setBusyTel(false); }
          }}>
            <Label htmlFor="meu-telefone">Telefone</Label>
            <div className="flex gap-2">
              <Input id="meu-telefone" type="tel" inputMode="tel" maxLength={20} placeholder="(00) 00000-0000" value={tel} onChange={(e) => setTelefone(e.target.value)} />
              <Button type="submit" disabled={busyTel || telefone === null}><Phone className="mr-2 size-4" />{busyTel ? "Salvando…" : "Salvar"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <TrocarSenha email={perfil.email} />
    </div>
  );
}

function TrocarSenha({ email }: { email: string }) {
  const [atual, setAtual] = useState(""), [nova, setNova] = useState(""), [repetir, setRepetir] = useState("");
  const [mostrar, setMostrar] = useState(false), [busy, setBusy] = useState(false), [erro, setErro] = useState("");
  async function trocar(e: React.FormEvent) {
    e.preventDefault(); setErro("");
    if (nova.length < SENHA_MINIMA) return setErro(`A nova senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
    if (nova !== repetir) return setErro("A confirmação não é igual à nova senha.");
    if (nova === atual) return setErro("A nova senha precisa ser diferente da atual.");
    setBusy(true);
    try {
      const { error: errAtual } = await supabase.auth.signInWithPassword({ email, password: atual });
      if (errAtual) throw new Error("Senha atual incorreta.");
      const { error } = await supabase.auth.updateUser({ password: nova });
      if (error) throw new Error(/weak|pwned|leaked/i.test(error.message) ? "Essa senha é fraca ou já apareceu em vazamentos. Escolha outra." : "Não foi possível trocar a senha.");
      setAtual(""); setNova(""); setRepetir("");
      toast.success("Senha alterada.");
    } catch (err) { setErro(err instanceof Error ? err.message : "Não foi possível trocar a senha."); }
    finally { setBusy(false); }
  }
  const tipo = mostrar ? "text" : "password";
  return (
    <Card>
      <CardHeader><CardTitle className="font-display text-lg">Trocar senha</CardTitle></CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={trocar}>
          <div className="space-y-2"><Label htmlFor="senha-atual">Senha atual</Label><Input id="senha-atual" type={tipo} autoComplete="current-password" value={atual} onChange={(e) => setAtual(e.target.value)} required /></div>
          <div className="space-y-2"><Label htmlFor="senha-nova">Nova senha</Label><Input id="senha-nova" type={tipo} autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} required /><p className="text-xs text-muted-foreground">Pelo menos {SENHA_MINIMA} caracteres.</p></div>
          <div className="space-y-2"><Label htmlFor="senha-repetir">Repita a nova senha</Label><Input id="senha-repetir" type={tipo} autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} required /></div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setMostrar((v) => !v)}>{mostrar ? <EyeOff className="mr-2 size-4" /> : <Eye className="mr-2 size-4" />}{mostrar ? "Ocultar senhas" : "Mostrar senhas"}</Button>
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <Button type="submit" disabled={busy || !atual || !nova || !repetir}><KeyRound className="mr-2 size-4" />{busy ? "Alterando…" : "Trocar senha"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
