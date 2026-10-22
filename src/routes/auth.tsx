import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, GraduationCap, Loader2, Lock, Mail, Users, WifiOff } from "lucide-react";
import { toast } from "sonner";
import loginFundoVertical from "@/assets/login-fundo-ondas-vertical.jpg.asset.json";
import loginFundo from "@/assets/login-fundo-ondas.jpg.asset.json";
import logoEsporte360 from "@/assets/logo-esporte360.png.asset.json";
import seculjeSelo from "@/assets/seculje-selo.png.asset.json";
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
    <div className="relative min-h-dvh overflow-hidden bg-sidebar">
      {/* Fundo com as ondas do Programa Esporte 360 (vertical no celular, horizontal na tela larga).
          O logo Esporte 360 fica acima da área de login centralizada e o selo SECULJE no canto
          inferior direito (no celular, abaixo da área de login), para nada ficar cortado. */}
      <img
        src={loginFundoVertical.url}
        alt=""
        aria-hidden
        className="pointer-events-none fixed inset-0 h-full w-full select-none object-cover object-center tela-larga:hidden"
      />
      <img
        src={loginFundo.url}
        alt=""
        aria-hidden
        className="pointer-events-none fixed inset-0 hidden h-full w-full select-none object-cover object-center tela-larga:block"
      />
      <div aria-hidden className="pointer-events-none fixed inset-0 bg-gradient-to-b from-sidebar/30 via-sidebar/5 to-sidebar/60" />
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-1/2 size-[min(44rem,120vw)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/20 blur-3xl"
      />
      <img
        src={seculjeSelo.url}
        alt="SECULJE – Prefeitura de Lauro de Freitas"
        className="pointer-events-none fixed bottom-4 right-4 z-0 hidden w-[clamp(140px,15vw,260px)] select-none opacity-90 tela-larga:block"
      />

      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[28rem] flex-col items-center justify-center gap-5 px-4 py-6">
        <img
          src={logoEsporte360.url}
          alt="Programa Esporte 360"
          className="h-[clamp(44px,9vh,92px)] w-auto select-none drop-shadow-[0_6px_18px_color-mix(in_oklab,var(--sidebar)_70%,transparent)]"
        />

        <Card className="relative w-full overflow-hidden rounded-3xl border-border/60 bg-card/95 shadow-2xl backdrop-blur-xl">
          <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-accent to-warning" />
            <CardHeader className="items-center gap-1 pb-4 pt-7 text-center">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-primary">Arena Aquática LF</p>
              <CardTitle className="font-display text-2xl">
                {acesso === "aluno" ? "Área do aluno" : titulo}
              </CardTitle>
              <CardDescription>
                {acesso === "aluno"
                  ? "Consulte suas aulas, sua frequência e seu crachá."
                  : modo === "criar" && !recuperando && !redefinindo
                  ? "Crie sua conta. Um administrador precisará liberar seu acesso."
                  : "Entre para gerenciar alunos, turmas e presenças."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={acesso} onValueChange={setAcesso}>
                <TabsList className="mb-5 grid h-12 w-full grid-cols-2 rounded-xl bg-muted p-1" aria-label="Tipo de acesso">
                  <TabsTrigger
                    value="equipe"
                    disabled={busy || redefinindo}
                    className="h-full gap-2 rounded-lg text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-md"
                  >
                    <Users className="size-4" /> Equipe
                  </TabsTrigger>
                  <TabsTrigger
                    value="aluno"
                    disabled={busy || redefinindo}
                    className="h-full gap-2 rounded-lg text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-md"
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <Checkbox checked={lembrarEmail} onCheckedChange={(v) => setLembrarEmail(v === true)} />
                      Lembrar meu e-mail
                    </label>
                    <button
                      type="button"
                      className="text-sm font-medium text-primary hover:underline"
                      onClick={() => {
                        setEmailRecuperacao(email);
                        setRecuperando(true);
                      }}
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <Button type="submit" variant="pool" className="h-12 w-full rounded-xl text-base" disabled={busy || offline}>
                    {busy ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Entrando...
                      </>
                    ) : (
                      <>
                        Entrar <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                  <p className="border-t border-border/70 pt-4 text-center text-sm text-muted-foreground">
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

        <img
          src={seculjeSelo.url}
          alt="SECULJE – Prefeitura de Lauro de Freitas"
          className="w-44 select-none opacity-90 tela-larga:hidden"
        />
      </main>
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

