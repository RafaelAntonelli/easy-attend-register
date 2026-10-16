import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Search, ShieldCheck, UserCheck, UserX, LockKeyhole, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { AppRole } from "@/lib/auth";
import { PERMISSOES_PROFESSOR, permissaoAtiva, usePermissoesProfessor } from "@/lib/permissoes";
import { normalizarTexto } from "@/lib/formatacao";
import { removerContaPendente, confirmarSenhaPermissoes, alterarPermissaoProfessor } from "@/lib/equipe.functions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/equipe")({
  component: EquipePage,
  head: () => ({
    meta: [
      { title: "Equipe | Arena Aquática" },
      { name: "description", content: "Controle quem da equipe pode acessar os dados de alunos, turmas e presenças." },
      { property: "og:title", content: "Equipe | Arena Aquática" },
      { property: "og:description", content: "Gestão de acessos da equipe da Arena Aquática." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Membro = {
  id: string;
  nome: string | null;
  email: string | null;
  roles: AppRole[];
  criado: string | null;
  ultimoAcesso: string | null;
};
type TurmaResumo = { id: string; nome: string };
type Acao = { membro: Membro; role: AppRole | null; apagar?: boolean };

function dataHora(v: string | null) {
  return v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
}

function EquipePage() {
  const { isAdmin, loading, user } = useAuth();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [vinculos, setVinculos] = useState<{ user_id: string; turma_id: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [acao, setAcao] = useState<Acao | null>(null);
  const [editandoTurmas, setEditandoTurmas] = useState<Membro | null>(null);
  const [selTurmas, setSelTurmas] = useState<Set<string>>(new Set());
  const { mapa, setMapa } = usePermissoesProfessor();
  const [aba, setAba] = useState("equipe");
  const [pedirSenha, setPedirSenha] = useState(false);
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [confirmandoSenha, setConfirmandoSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState<{ token: string; expiresAt: string } | null>(null);
  const [salvandoPermissao, setSalvandoPermissao] = useState(false);

  useEffect(() => {
    if (!confirmacao) return;
    const timer = window.setTimeout(() => { setConfirmacao(null); setAba("equipe"); }, Math.max(0, Date.parse(confirmacao.expiresAt) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [confirmacao]);

  useEffect(() => { setConfirmacao(null); setAba("equipe"); }, [user?.id]);

  function trocarAba(valor: string) {
    if (valor === "permissoes" && !confirmacao) {
      setErroSenha(""); setSenha(""); setMostrarSenha(false); setPedirSenha(true);
      return;
    }
    if (valor === "equipe") setConfirmacao(null);
    setAba(valor);
  }

  async function confirmarAdministrador(e: React.FormEvent) {
    e.preventDefault();
    setConfirmandoSenha(true); setErroSenha("");
    try {
      const resultado = await confirmarSenhaPermissoes({ data: { senha } });
      setConfirmacao(resultado); setSenha(""); setPedirSenha(false); setAba("permissoes");
    } catch (e) {
      setErroSenha(e instanceof Error ? e.message : "Não foi possível confirmar a senha.");
      setSenha("");
    } finally { setConfirmandoSenha(false); }
  }

  async function carregar() {
    setCarregando(true);
    const [{ data: perfis }, { data: papeis }, { data: acessos }, { data: ts }, { data: vs }] = await Promise.all([
      supabase.from("profiles").select("id, nome, email, created_at"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.rpc("equipe_acessos"),
      supabase.from("turmas").select("id, nome").eq("ativa", true).order("nome"),
      supabase.from("professor_turmas").select("user_id, turma_id"),
    ]);
    const mapaRoles = new Map<string, AppRole[]>();
    for (const p of (papeis ?? []) as { user_id: string; role: AppRole }[]) {
      mapaRoles.set(p.user_id, [...(mapaRoles.get(p.user_id) ?? []), p.role]);
    }
    const mapaAcesso = new Map((acessos ?? []).map((a) => [a.id, a.last_sign_in_at as string | null]));
    setMembros(
      (perfis ?? []).map((p) => ({
        id: p.id,
        nome: p.nome,
        email: p.email,
        criado: p.created_at,
        roles: mapaRoles.get(p.id) ?? [],
        ultimoAcesso: mapaAcesso.get(p.id) ?? null,
      })),
    );
    setTurmas(ts ?? []);
    setVinculos(vs ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    if (isAdmin) void carregar();
    else setCarregando(false);
  }, [isAdmin]);

  async function definirPapel(userId: string, role: AppRole | null) {
    const del = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (del.error) { toast.error(del.error.message); return; }
    if (role) {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Acesso atualizado");
    void carregar();
  }

  async function apagarConta(userId: string) {
    try {
      await removerContaPendente({ data: { userId } });
      toast.success("Conta removida");
      void carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível remover");
    }
  }

  async function alternarPermissao(chave: string, ativo: boolean) {
    if (!confirmacao || salvandoPermissao) return;
    const anterior = mapa[chave];
    setMapa((m) => ({ ...m, [chave]: ativo }));
    setSalvandoPermissao(true);
    try {
      await alterarPermissaoProfessor({ data: { token: confirmacao.token, chave, ativo } });
      toast.success(ativo ? "Permissão liberada" : "Permissão bloqueada");
    } catch (e) {
      setMapa((m) => { const n = { ...m }; if (anterior === undefined) delete n[chave]; else n[chave] = anterior; return n; });
      setConfirmacao(null); setAba("equipe");
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar a permissão.");
    } finally { setSalvandoPermissao(false); }
  }

  async function salvarTurmas() {
    if (!editandoTurmas) return;
    const id = editandoTurmas.id;
    const del = await supabase.from("professor_turmas").delete().eq("user_id", id);
    if (del.error) { toast.error(del.error.message); return; }
    if (selTurmas.size) {
      const { error } = await supabase
        .from("professor_turmas")
        .insert([...selTurmas].map((turma_id) => ({ user_id: id, turma_id })));
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Turmas atualizadas");
    setEditandoTurmas(null);
    void carregar();
  }

  const nomesTurma = useMemo(() => new Map(turmas.map((t) => [t.id, t.nome])), [turmas]);
  const termo = normalizarTexto(busca);
  const filtrados = membros.filter(
    (m) => !termo || normalizarTexto(`${m.nome ?? ""} ${m.email ?? ""}`).includes(termo),
  );
  const grupos = [
    { titulo: "Aguardando liberação", lista: filtrados.filter((m) => m.roles.length === 0) },
    { titulo: "Professores", lista: filtrados.filter((m) => m.roles.includes("professor") && !m.roles.includes("admin")) },
    { titulo: "Administradores", lista: filtrados.filter((m) => m.roles.includes("admin")) },
  ];

  if (loading) return null;

  function cartao(m: Membro) {
    const turmasDele = vinculos.filter((v) => v.user_id === m.id).map((v) => nomesTurma.get(v.turma_id)).filter(Boolean);
    const pendente = m.roles.length === 0;
    return (
      <Card key={m.id}>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-medium text-foreground">{m.nome || m.email || "Sem nome"}</p>
            <p className="text-xs text-muted-foreground">{m.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Cadastro: {dataHora(m.criado)} · Último acesso: {dataHora(m.ultimoAcesso)}
            </p>
            {m.roles.includes("professor") ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Turmas: {turmasDele.length ? turmasDele.join(", ") : "nenhuma"}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {pendente ? (
              <Button size="sm" onClick={() => definirPapel(m.id, "professor")}>
                <UserCheck className="mr-1 size-4" /> Liberar acesso
              </Button>
            ) : null}
            {pendente ? (
              <Button size="sm" variant="ghost" disabled={m.id === user?.id} onClick={() => setAcao({ membro: m, role: null, apagar: true })}>
                <UserX className="mr-1 size-4" /> Remover
              </Button>
            ) : null}
            {m.roles.includes("professor") ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelTurmas(new Set(vinculos.filter((v) => v.user_id === m.id).map((v) => v.turma_id)));
                  setEditandoTurmas(m);
                }}
              >
                <CalendarDays className="mr-1 size-4" /> Turmas
              </Button>
            ) : null}
            {!pendente && !m.roles.includes("professor") ? (
              <Button size="sm" variant="outline" disabled={m.id === user?.id} onClick={() => definirPapel(m.id, "professor")}>
                <UserCheck className="mr-1 size-4" /> Tornar professor
              </Button>
            ) : null}
            {!m.roles.includes("admin") ? (
              <Button size="sm" variant="outline" onClick={() => setAcao({ membro: m, role: "admin" })}>
                <ShieldCheck className="mr-1 size-4" /> Administrador
              </Button>
            ) : null}
            {!pendente ? (
              <Button size="sm" variant="ghost" disabled={m.id === user?.id} onClick={() => setAcao({ membro: m, role: null })}>
                <UserX className="mr-1 size-4" /> Remover
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <AppShell title="Equipe" subtitle="Defina quem pode acessar os dados do sistema">
      {!isAdmin ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Apenas administradores podem gerenciar os acessos da equipe.
          </CardContent>
        </Card>
      ) : carregando ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <Tabs value={aba} onValueChange={trocarAba}>
          <TabsList>
            <TabsTrigger value="equipe">Equipe</TabsTrigger>
            <TabsTrigger value="permissoes"><LockKeyhole className="mr-1 size-4" />Permissões dos professores</TabsTrigger>
          </TabsList>

          <TabsContent value="equipe" className="mt-4 space-y-6">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            {grupos.map((g) => (
              <section key={g.titulo}>
                <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold text-foreground">
                  {g.titulo} <Badge variant="secondary">{g.lista.length}</Badge>
                </h2>
                {g.lista.length ? (
                  <div className="grid gap-3">{g.lista.map(cartao)}</div>
                ) : (
                  <p className="text-sm text-muted-foreground">Ninguém aqui.</p>
                )}
              </section>
            ))}
          </TabsContent>

          {confirmacao ? <TabsContent value="permissoes" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">O que todos os professores podem fazer</CardTitle>
                <p className="text-sm text-muted-foreground">
                  O bloqueio vale no próprio sistema. Excluir alunos, Backup e Equipe são sempre só de administradores.
                  Ver alunos, turmas e presenças continua liberado.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                {[...new Set(PERMISSOES_PROFESSOR.map((p) => p.area))].map((area) => (
                  <div key={area}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{area}</p>
                    <div className="space-y-2">
                      {PERMISSOES_PROFESSOR.filter((p) => p.area === area).map((p) => (
                        <label key={p.chave} className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                          <span className="text-sm text-foreground">{p.rotulo}</span>
                          <Switch
                            checked={permissaoAtiva(mapa, p.chave)}
                            disabled={salvandoPermissao}
                            aria-label={p.rotulo}
                            onCheckedChange={(v) => alternarPermissao(p.chave, v)}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent> : null}
        </Tabs>
      )}

      <Dialog open={pedirSenha} onOpenChange={(o) => { if (!confirmandoSenha) { setPedirSenha(o); setSenha(""); setErroSenha(""); } }}>
        <DialogContent className="sm:max-w-md" aria-describedby="confirmar-admin-descricao">
          <DialogHeader><DialogTitle>Confirmar senha do administrador</DialogTitle></DialogHeader>
          <p id="confirmar-admin-descricao" className="text-sm text-muted-foreground">Digite a senha da sua conta de administrador para acessar as permissões dos professores.</p>
          <form onSubmit={confirmarAdministrador} className="space-y-4">
            <div className="relative">
              <Input autoFocus aria-label="Senha do administrador" autoComplete="current-password" type={mostrarSenha ? "text" : "password"} className="pr-12" value={senha} onChange={(e) => setSenha(e.target.value)} required disabled={confirmandoSenha} />
              <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2" aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"} onClick={() => setMostrarSenha((v) => !v)}>{mostrarSenha ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</Button>
            </div>
            {erroSenha ? <p role="alert" className="text-sm text-destructive">{erroSenha}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={confirmandoSenha} onClick={() => { setPedirSenha(false); setSenha(""); }}>Cancelar</Button>
              <Button type="submit" disabled={confirmandoSenha || !senha}>{confirmandoSenha ? "Confirmando…" : "Confirmar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!acao} onOpenChange={(o) => !o && setAcao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{acao?.apagar ? "Remover conta?" : acao?.role === "admin" ? "Tornar administrador?" : "Remover acesso?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {acao?.apagar
                ? `A conta de ${acao.membro.nome || acao.membro.email} será apagada. A pessoa precisará criar uma nova conta para pedir acesso de novo.`
                : acao?.role === "admin"
                ? `${acao?.membro.nome || acao?.membro.email} poderá gerenciar a equipe, o backup e excluir dados.`
                : `${acao?.membro.nome || acao?.membro.email} não conseguirá mais acessar os dados do sistema.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (acao?.apagar) void apagarConta(acao.membro.id);
                else if (acao) void definirPapel(acao.membro.id, acao.role);
                setAcao(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editandoTurmas} onOpenChange={(o) => !o && setEditandoTurmas(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Turmas de {editandoTurmas?.nome || editandoTurmas?.email}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Essas turmas aparecem primeiro para ele em Turmas e Presença.</p>
          <div className="space-y-2">
            {turmas.map((t) => (
              <label key={t.id} className="flex items-center gap-3 rounded-md border border-border p-2 text-sm">
                <Checkbox
                  checked={selTurmas.has(t.id)}
                  onCheckedChange={(v) =>
                    setSelTurmas((s) => {
                      const n = new Set(s);
                      if (v) n.add(t.id);
                      else n.delete(t.id);
                      return n;
                    })
                  }
                />
                {t.nome}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditandoTurmas(null)}>Cancelar</Button>
            <Button onClick={salvarTurmas}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
