import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { permissaoAtiva, usePermissoesProfessor } from "@/lib/permissoes";
import { useTema } from "@/lib/tema";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusOffline } from "@/components/StatusOffline";

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

  const nav = isAdmin
    ? [...baseNav, ...adminNav]
    : baseNav.filter((n) => n.to !== "/relatorios" || permissaoAtiva(permissoes, "relatorios_ver"));
  const navCelular = nav.filter((n) => PRINCIPAIS_CELULAR.includes(n.to));
  const navMais = nav.filter((n) => !PRINCIPAIS_CELULAR.includes(n.to));
  const maisAtivo = navMais.some((n) => n.to === pathname);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar px-4 py-5 md:flex">
        <div className="flex shrink-0 items-center gap-3 px-2">
          <img src="/icons/icon-192x192.png" alt="Arena Aquática LF" className="size-10 rounded-xl object-cover" />
          <div className="leading-tight">
            <p className="font-display text-base font-semibold text-sidebar-foreground">Arena Aquática LF</p>
            <p className="text-xs text-sidebar-foreground/60">Gestão de alunos</p>
          </div>
        </div>
        <nav aria-label="Menu principal" className="my-5 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain">
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
        <div className="shrink-0 space-y-1 border-t border-sidebar-border pt-3">
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

      <header className="bg-sidebar px-5 pb-6 pt-5 text-sidebar-foreground md:border-b md:border-border md:bg-card/60 md:px-10 md:py-6 md:text-foreground md:backdrop-blur">
        <div className="mb-4 flex items-center gap-2.5 md:hidden">
          <img src="/icons/icon-192x192.png" alt="" className="size-8 rounded-lg object-cover" />
          <span className="font-display text-sm font-semibold">Arena Aquática LF</span>
        </div>
        <h1 className="min-w-0 break-words font-display text-2xl font-semibold md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-sidebar-foreground/70 md:text-muted-foreground">{subtitle}</p> : null}
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
