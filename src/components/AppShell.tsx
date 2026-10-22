import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  QrCode,
  LogOut,
  Waves,
  ShieldCheck,
  FileBarChart,
  CloudUpload,
  Bell,
  MoreHorizontal,
  Moon,
  Sun,
  UserRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { permissaoAtiva, usePermissoesProfessor } from "@/lib/permissoes";
import { useTema } from "@/lib/tema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusOffline } from "@/components/StatusOffline";
import { obterMeuPerfil } from "@/lib/meu-perfil.functions";
import fundoEsporte360 from "@/assets/programa-esporte-360.png.asset.json";
import fundoSeculje from "@/assets/barra-seculje.jpg.asset.json";

const baseNav = [
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/alunos", label: "Alunos", icon: Users },
  { to: "/turmas", label: "Turmas", icon: CalendarDays },
  { to: "/presenca", label: "Presença", icon: QrCode },
  { to: "/relatorios", label: "Relatórios", icon: FileBarChart },
];
const adminNav = [
  { to: "/avisos", label: "Avisos", icon: Bell },
  { to: "/backup", label: "Backup", icon: CloudUpload },
  { to: "/equipe", label: "Equipe", icon: ShieldCheck },
];
/** Botões fixos na barra de baixo do celular; o resto fica em "Mais". */
const PRINCIPAIS_CELULAR = ["/", "/alunos", "/turmas", "/presenca"];

export function AppShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  const { session, loading, isStaff, isAdmin, isStudent } = useAuth();
  const queryClient = useQueryClient();
  const { mapa: permissoes } = usePermissoesProfessor();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { escuro, alternar } = useTema();
  const [maisAberto, setMaisAberto] = useState(false);
  const { data: perfil } = useQuery({
    queryKey: ["meu-perfil"],
    queryFn: () => obterMeuPerfil(),
    enabled: !!session && isStaff,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
    else if (!loading && isStudent && !isStaff) navigate({ to: "/area-aluno", replace: true });
  }, [loading, session, navigate, isStudent, isStaff]);

  async function sair() {
    setMaisAberto(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (loading || !session || (isStudent && !isStaff)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Waves className="size-8 animate-pulse text-primary" />
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <Waves className="size-8 text-primary" />
        <div>
          <h1 className="font-display text-xl font-semibold text-foreground">Acesso aguardando liberação</h1>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Sua conta foi criada, mas ainda não tem permissão para acessar os dados. Peça a um administrador da Arena
            Aquática para liberar seu acesso.
          </p>
        </div>
        <Button variant="outline" onClick={() => void sair()}>
          <LogOut className="mr-2 size-4" /> Sair
        </Button>
      </div>
    );
  }

  const nomeUsuario = perfil?.nome?.trim() || session.user.email || "Equipe";
  const papel = isAdmin ? "Administrador" : "Professor";
  const nav = isAdmin
    ? [...baseNav, ...adminNav]
    : baseNav.filter((n) => n.to !== "/relatorios" || permissaoAtiva(permissoes, "relatorios_ver"));
  const navCelular = nav.filter((n) => PRINCIPAIS_CELULAR.includes(n.to));
  const navMais = nav.filter((n) => !PRINCIPAIS_CELULAR.includes(n.to));
  const maisAtivo = navMais.some((n) => n.to === pathname) || pathname === "/meu-perfil";

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar px-4 py-5 md:flex">
        {/* Imagem do Esporte 360 deitada na vertical, com o logo no centro do menu. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <img
            src={fundoEsporte360.url}
            alt=""
            className="h-auto w-[85vh] max-w-none shrink-0 -rotate-90 select-none opacity-30 [mask-image:linear-gradient(to_right,transparent_0%,black_15%,black_85%,transparent_100%)]"
          />
        </div>
        <Link to="/meu-perfil" className="relative flex shrink-0 items-center gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-sidebar-accent" title="Meu perfil">
          <FotoUsuario url={perfil?.fotoUrl ?? null} nome={nomeUsuario} className="size-11" />
          <div className="min-w-0 leading-tight">
            <p className="truncate font-display text-base font-semibold text-sidebar-foreground">{nomeUsuario}</p>
            <p className="text-xs text-sidebar-foreground/70">{papel}</p>
          </div>
        </Link>
        <nav aria-label="Menu principal" className="relative my-5 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                pathname === item.to && "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_var(--sidebar-primary)]",
              )}
            >
              <item.icon className={cn("size-4", pathname === item.to && "text-sidebar-primary")} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="relative shrink-0 space-y-1 border-t border-sidebar-border pt-3">
          <Link
            to="/meu-perfil"
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
              pathname === "/meu-perfil" && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
          >
            <UserRound className={cn("size-4", pathname === "/meu-perfil" && "text-sidebar-primary")} /> Meu perfil
          </Link>
          <Button
            variant="ghost"
            className="min-h-11 w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={alternar}
            aria-pressed={escuro}
          >
            {escuro ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {escuro ? "Modo claro" : "Modo escuro"}
          </Button>
          <Button
            variant="ghost"
            className="min-h-11 w-full justify-start gap-3 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            onClick={() => void sair()}
          >
            <LogOut className="size-4" /> Sair
          </Button>
        </div>
      </aside>

      <StatusOffline />

      <header className="relative overflow-hidden bg-faixa-celular px-5 pb-6 pt-5 text-sidebar-foreground md:border-b md:border-border md:bg-faixa md:px-10 md:py-6 md:text-foreground">
        <img
          src={fundoSeculje.url}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 h-full w-full select-none object-cover object-right opacity-40 [mask-image:linear-gradient(to_right,transparent_0%,black_60%)] md:w-auto md:max-w-none md:opacity-90 md:[mask-image:linear-gradient(to_right,transparent_0%,black_30%)]"
        />
        <Link to="/meu-perfil" className="relative mb-4 flex w-fit items-center gap-2.5 md:hidden">
          <FotoUsuario url={perfil?.fotoUrl ?? null} nome={nomeUsuario} className="size-9" />
          <span className="leading-tight">
            <span className="block font-display text-sm font-semibold">{nomeUsuario}</span>
            <span className="block text-xs text-sidebar-foreground/70">{papel}</span>
          </span>
        </Link>
        <h1 className="relative min-w-0 break-words font-display text-2xl font-semibold md:text-3xl">{title}</h1>
        {subtitle ? <p className="relative mt-1 text-sm text-sidebar-foreground/70 md:text-muted-foreground">{subtitle}</p> : null}
      </header>

      <main className="px-4 py-6 sm:px-5 md:px-10">{children}</main>

      <nav
        aria-label="Menu do celular"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {navCelular.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium text-sidebar-foreground/60",
              pathname === item.to && "text-sidebar-primary",
            )}
          >
            <item.icon className="size-5" />
            {item.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMaisAberto(true)}
          aria-label="Mais opções"
          className={cn(
            "flex min-w-0 flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium text-sidebar-foreground/60",
            (maisAtivo || maisAberto) && "text-sidebar-primary",
          )}
        >
          <MoreHorizontal className="size-5" />
          Mais
        </button>
      </nav>

      <Sheet open={maisAberto} onOpenChange={setMaisAberto}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display">Mais opções</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid gap-2">
            {navMais.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMaisAberto(false)}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-xl border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent",
                  pathname === item.to && "border-primary bg-secondary text-secondary-foreground",
                )}
              >
                <item.icon className="size-5 text-primary" />
                {item.label}
              </Link>
            ))}
            <Link
              to="/meu-perfil"
              onClick={() => setMaisAberto(false)}
              className={cn(
                "flex min-h-12 items-center gap-3 rounded-xl border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent",
                pathname === "/meu-perfil" && "border-primary bg-secondary text-secondary-foreground",
              )}
            >
              <UserRound className="size-5 text-primary" />
              Meu perfil
            </Link>
            <button
              type="button"
              onClick={alternar}
              aria-pressed={escuro}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              {escuro ? <Sun className="size-5 text-primary" /> : <Moon className="size-5 text-primary" />}
              {escuro ? "Modo claro" : "Modo escuro"}
            </button>
            <button
              type="button"
              onClick={() => void sair()}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-destructive/40 px-4 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="size-5" /> Sair
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Foto do usuário logado; sem foto, mostra as iniciais. */
function FotoUsuario({ url, nome, className }: { url: string | null; nome: string; className?: string }) {
  const iniciais = nome.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
  return url ? (
    <img src={url} alt={`Foto de ${nome}`} className={cn("shrink-0 rounded-full object-cover ring-2 ring-sidebar-primary/60", className)} />
  ) : (
    <span aria-hidden="true" className={cn("flex shrink-0 items-center justify-center rounded-full bg-sidebar-accent font-display text-sm font-semibold text-sidebar-accent-foreground ring-2 ring-sidebar-primary/60", className)}>
      {iniciais}
    </span>
  );
}
