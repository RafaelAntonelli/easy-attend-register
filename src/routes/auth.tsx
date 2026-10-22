import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, GraduationCap, Lock, Mail, Users, WifiOff } from "lucide-react";
import { toast } from "sonner";
import loginImagem from "@/assets/login-esporte360-seculje.png.asset.json";
import { supabase } from "@/integrations/supabase/client";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AcessoAlunoLogin } from "@/components/AcessoAlunoLogin";

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

const CHAVE_LEMBRAR_EMAIL = "arena-lembrar-email";

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
      <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        type={ver ? "text" : "password"}
        required
        minLength={minLength}
        value={value}
        placeholder="Sua senha"
        autoComplete="current-password"
        onChange={(e) => onChange(e.target.value)}
        className="h-12 rounded-xl pl-10 pr-11"
      />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        aria-label={ver ? "Esconder senha" : "Mostrar senha"}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground"
      >
        {ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function AuthPage() {
  const { session, loading, isStudent } = useAuth();
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
  const [acesso, setAcesso] = useState("equipe");
  const [lembrarEmail, setLembrarEmail] = useState(false);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_LEMBRAR_EMAIL);
      if (salvo) {
        setEmail(salvo);
        setLembrarEmail(true);
      }
    } catch {
      /* armazenamento indisponível */
    }
  }, []);

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
    if (!loading && session && !redefinindo) navigate({ to: isStudent ? "/area-aluno" : "/" });
  }, [loading, session, navigate, redefinindo, isStudent]);

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
    try {
      if (lembrarEmail) localStorage.setItem(CHAVE_LEMBRAR_EMAIL, email.trim());
      else localStorage.removeItem(CHAVE_LEMBRAR_EMAIL);
    } catch {
      /* armazenamento indisponível */
    }
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
    <div className="relative min-h-screen overflow-hidden bg-sidebar">
      {/* Imagem do Programa Esporte 360 + SECULJE preenchendo a tela inteira, com transparência */}
      <img
        src={loginImagem.url}
        alt=""
        aria-hidden
        className="pointer-events-none fixed inset-0 h-full w-full select-none object-cover object-center opacity-75"
      />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-sidebar/40 via-sidebar/10 to-sidebar/50" />

      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="px-6 pb-16 pt-10 text-center text-sidebar-foreground lg:pb-6">
          <p className="font-display text-2xl font-semibold drop-shadow">Arena Aquática LF</p>
          <p className="mt-1 text-sm text-sidebar-foreground/80">Bem-vindo(a) de volta!</p>
        </div>

        <div className="relative -mt-10 flex flex-1 items-start justify-center px-4 pb-8 lg:mt-0 lg:items-center lg:p-10">
          <Card className="w-full max-w-md rounded-3xl border-border/70 shadow-pool">
            <CardHeader className="items-center pb-4 text-center">
              <CardTitle className="font-display text-2xl">
                {acesso === "aluno" ? (
                  "Área do aluno"
                ) : !redefinindo && !recuperando && modo === "entrar" ? (
                  <>
                    <span className="lg:hidden">Acesse sua conta</span>
                    <span className="hidden lg:inline">{titulo}</span>
                  </>
                ) : (
                  titulo
                )}
              </CardTitle>
              <CardDescription>
                {acesso === "aluno"
                  ? "Arena Aquática LF"
                  : modo === "criar" && !recuperando && !redefinindo
                  ? "Crie sua conta. Um administrador precisará liberar seu acesso."
                  : "Entre para gerenciar alunos, turmas e presenças."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={acesso} onValueChange={setAcesso}>
                <TabsList className="mb-5 grid h-12 w-full grid-cols-2 rounded-xl p-1" aria-label="Tipo de acesso">
                  <TabsTrigger
                    value="equipe"
                    disabled={busy || redefinindo}
                    className="h-full gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Users className="size-4" /> Equipe
                  </TabsTrigger>
                  <TabsTrigger
                    value="aluno"
                    disabled={busy || redefinindo}
                    className="h-full gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <GraduationCap className="size-4" /> Aluno
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="aluno" className="space-y-4 text-center">
                  <AcessoAlunoLogin offline={offline} />
                </TabsContent>
                <TabsContent value="equipe">
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
                  <Button type="submit" variant="pool" className="h-12 w-full rounded-xl text-base" disabled={busy || offline}>
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
                    <CampoComIcone icone={Mail}>
                      <Input
                        id="email-recuperacao"
                        type="email"
                        required
                        value={emailRecuperacao}
                        onChange={(e) => setEmailRecuperacao(e.target.value)}
                        className="h-12 rounded-xl pl-10"
                      />
                    </CampoComIcone>
                  </div>
                  <Button type="submit" variant="pool" className="h-12 w-full rounded-xl text-base" disabled={busy || offline}>
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
                      variant="pool"
                      className="h-12 w-full rounded-xl"
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
                      <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} className="h-12 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email2">E-mail</Label>
                      <CampoComIcone icone={Mail}>
                        <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl pl-10" />
                      </CampoComIcone>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="senha2">Senha</Label>
                      <CampoSenha id="senha2" minLength={6} value={senha} onChange={setSenha} />
                    </div>
                    <Button type="submit" variant="pool" className="h-12 w-full rounded-xl text-base" disabled={busy || offline}>
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
                    <CampoComIcone icone={Mail}>
                      <Input
                        id="email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12 rounded-xl pl-10"
                      />
                    </CampoComIcone>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="senha">Senha</Label>
                    <CampoSenha id="senha" value={senha} onChange={setSenha} />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <Checkbox checked={lembrarEmail} onCheckedChange={(v) => setLembrarEmail(v === true)} />
                    Lembrar meu e-mail
                  </label>
                  <Button type="submit" variant="pool" className="h-12 w-full rounded-xl text-base" disabled={busy || offline}>
                    {busy ? "Entrando..." : "Entrar"} <ArrowRight className="size-4" />
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
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    Sou novo na equipe?{" "}
                    <button
                      type="button"
                      className="font-semibold text-primary hover:underline"
                      onClick={() => setModo("criar")}
                    >
                      Solicitar acesso
                    </button>
                  </p>
                </form>
              )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CampoComIcone({ icone: Icone, children }: { icone: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="relative">
      <Icone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      {children}
    </div>
  );
}

