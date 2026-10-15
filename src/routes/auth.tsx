import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, WifiOff } from "lucide-react";
import { toast } from "sonner";
import loginImagem from "@/assets/login-esporte-360.png.asset.json";
import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Entrar | Arena Aquática" },
      { name: "description", content: "Acesso da equipe da Arena Aquática ao sistema de matrículas e presença." },
      { property: "og:title", content: "Entrar | Arena Aquática" },
      { property: "og:description", content: "Acesso da equipe ao sistema de matrículas e presença." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function traduzirErro(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Este e-mail já está cadastrado. Use a opção Entrar.";
  if (m.includes("password should be at least") || m.includes("at least 6"))
    return "A senha deve ter pelo menos 6 caracteres.";
  if (m.includes("weak") || m.includes("pwned") || m.includes("leaked"))
    return "Esta senha é fraca ou já vazou na internet. Escolha outra.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes"))
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (m.includes("invalid email") || m.includes("unable to validate email")) return "E-mail inválido.";
  if (m.includes("same password") || m.includes("different from the old"))
    return "A nova senha deve ser diferente da anterior.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Sem conexão com a internet. Verifique sua rede.";
  return "Não foi possível concluir. Tente novamente.";
}

function CampoSenha({
  id,
  value,
  onChange,
  minLength,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  minLength?: number;
}) {
  const [ver, setVer] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={ver ? "text" : "password"}
        required
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        aria-label={ver ? "Esconder senha" : "Mostrar senha"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        {ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [recuperando, setRecuperando] = useState(false);
  const [emailRecuperacao, setEmailRecuperacao] = useState("");
  const [redefinindo, setRedefinindo] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");
  const [contaCriada, setContaCriada] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const atualizar = () => setOffline(!navigator.onLine);
    atualizar();
    window.addEventListener("online", atualizar);
    window.addEventListener("offline", atualizar);
    return () => {
      window.removeEventListener("online", atualizar);
      window.removeEventListener("offline", atualizar);
    };
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRedefinindo(true);
    });
    if (/type=recovery/.test(window.location.hash)) setRedefinindo(true);
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && session && !redefinindo) navigate({ to: "/" });
  }, [loading, session, navigate, redefinindo]);

  async function enviarRecuperacao(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(emailRecuperacao, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setBusy(false);
    if (error) { toast.error(traduzirErro(error.message)); return; }
    toast.success("Enviamos um link de recuperação para o seu e-mail.");
    setRecuperando(false);
  }

  async function definirNovaSenha(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    setBusy(false);
    if (error) { toast.error(traduzirErro(error.message)); return; }
    toast.success("Senha alterada com sucesso!");
    setRedefinindo(false);
    setNovaSenha("");
    navigate({ to: "/" });
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setBusy(false);
    if (error) { toast.error(traduzirErro(error.message)); return; }
    navigate({ to: "/" });
  }

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: { emailRedirectTo: window.location.origin, data: { nome } },
    });
    setBusy(false);
    if (error) { toast.error(traduzirErro(error.message)); return; }
    if (!data.session) {
      setContaCriada(true);
      return;
    }
    navigate({ to: "/" });
  }

  const titulo = redefinindo
    ? "Nova senha"
    : recuperando
      ? "Recuperar senha"
      : modo === "criar"
        ? "Cadastro da equipe"
        : "Bem-vindo(a) à Arena Aquática LF";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 text-primary-foreground lg:flex">
        <img
          src={loginImagem.url}
          alt="Programa Esporte 360"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/40 via-transparent to-primary/60" />
        <div className="relative z-10 flex items-center gap-3">
          <img src="/icons/icon-192x192.png" alt="Logo Arena Aquática LF" className="size-10 rounded-xl" />
          <span className="font-display text-xl font-semibold">Arena Aquática LF</span>
        </div>
        <div className="relative z-10">
          <p className="text-sm text-primary-foreground/80">Acesso exclusivo da equipe</p>
        </div>
      </div>

      <div className="flex flex-col">
        {/* Faixa da imagem no celular */}
        <div className="relative h-40 overflow-hidden lg:hidden">
          <img src={loginImagem.url} alt="Programa Esporte 360" className="h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-b from-primary/30 to-background" />
        </div>

        <div className="-mt-12 flex flex-1 items-start justify-center p-6 lg:mt-0 lg:items-center">
          <Card className="relative w-full max-w-md border-border/70 shadow-pool">
            <CardHeader className="items-center text-center">
              <img
                src="/icons/icon-192x192.png"
                alt="Logo Arena Aquática LF"
                className="mb-2 size-16 rounded-2xl shadow-md"
              />
              <CardTitle className="font-display text-2xl">{titulo}</CardTitle>
              <CardDescription>
                {modo === "criar" && !recuperando && !redefinindo
                  ? "Crie sua conta. Um administrador precisará liberar seu acesso."
                  : "Entre para gerenciar alunos, turmas e presenças."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {offline && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <WifiOff className="mt-0.5 size-4 shrink-0" />
                  <span>Você está sem internet. É preciso estar conectado para entrar no sistema.</span>
                </div>
              )}

              {redefinindo ? (
                <form onSubmit={definirNovaSenha} className="space-y-4">
                  <p className="text-sm text-muted-foreground">Defina uma nova senha para a sua conta.</p>
                  <div className="space-y-2">
                    <Label htmlFor="nova-senha">Nova senha</Label>
                    <CampoSenha id="nova-senha" minLength={6} value={novaSenha} onChange={setNovaSenha} />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy || offline}>
                    Salvar nova senha
                  </Button>
                </form>
              ) : recuperando ? (
                <form onSubmit={enviarRecuperacao} className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="email-recuperacao">E-mail</Label>
                    <Input
                      id="email-recuperacao"
                      type="email"
                      required
                      value={emailRecuperacao}
                      onChange={(e) => setEmailRecuperacao(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy || offline}>
                    Enviar link de recuperação
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setRecuperando(false)}>
                    Voltar para o login
                  </Button>
                </form>
              ) : modo === "criar" ? (
                contaCriada ? (
                  <div className="space-y-4 text-center">
                    <p className="text-sm text-foreground">
                      Conta criada! Confirme seu e-mail pelo link que enviamos. Depois, aguarde um administrador da
                      Arena Aquática liberar seu acesso.
                    </p>
                    <Button
                      className="w-full"
                      onClick={() => {
                        setContaCriada(false);
                        setModo("entrar");
                      }}
                    >
                      Voltar para o login
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={cadastrar} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome">Nome</Label>
                      <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email2">E-mail</Label>
                      <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="senha2">Senha</Label>
                      <CampoSenha id="senha2" minLength={6} value={senha} onChange={setSenha} />
                    </div>
                    <Button type="submit" className="w-full" disabled={busy || offline}>
                      Criar conta
                    </Button>
                    <Button type="button" variant="ghost" className="w-full" onClick={() => setModo("entrar")}>
                      Já tenho conta
                    </Button>
                  </form>
                )
              ) : (
                <form onSubmit={entrar} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="senha">Senha</Label>
                    <CampoSenha id="senha" value={senha} onChange={setSenha} />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy || offline}>
                    Entrar
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    className="w-full"
                    onClick={() => {
                      setEmailRecuperacao(email);
                      setRecuperando(true);
                    }}
                  >
                    Esqueci minha senha
                  </Button>
                  <p className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
                    Sou novo na equipe?{" "}
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => setModo("criar")}
                    >
                      Solicitar acesso
                    </button>
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
