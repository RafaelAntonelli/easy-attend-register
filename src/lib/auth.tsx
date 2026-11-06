import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { contaOffline, definirContaOffline, estaOnline, lerCache, salvarCache } from "./offline";

export type AppRole = "admin" | "professor";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [isStudent, setIsStudent] = useState(false);
  const [acessoOffline, setAcessoOffline] = useState(false);
  const [chamadaOffline, setChamadaOffline] = useState(false);
  const [usuarioLocalId, setUsuarioLocalId] = useState<string | null>(null);

  useEffect(() => {
    if (!estaOnline()) { setUsuarioLocalId(contaOffline()); setLoading(false); }
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!s && !estaOnline() && _event !== "SIGNED_OUT") { setLoading(false); return; }
      definirContaOffline(s?.user.id ?? null);
      setUsuarioLocalId(s?.user.id ?? null);
      setSession(s);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session && !estaOnline()) { setLoading(false); return; }
      definirContaOffline(data.session?.user.id ?? null);
      setUsuarioLocalId(data.session?.user.id ?? null);
      setSession(data.session);
      setLoading(false);
    }).catch(() => setLoading(false));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = session?.user?.id ?? (!estaOnline() ? usuarioLocalId : null);
    if (!userId) {
      setRoles([]);
      setIsStudent(false);
      setAcessoOffline(false);
      setChamadaOffline(false);
      setRolesLoading(false);
      return;
    }
    let active = true;
    setRolesLoading(true);
    const carregar = async () => {
      // Offline snapshots only enable the local roster/queue, never admin privileges.
      if (!estaOnline()) {
        const salvo = await lerCache<{ equipe: boolean; chamada: boolean }>("acesso-local");
        if (!active) return;
        setRoles([]);
        setIsStudent(false);
        setAcessoOffline(Boolean(salvo?.equipe));
        setChamadaOffline(Boolean(salvo?.chamada));
        setRolesLoading(false);
        return;
      }
      const [{ data, error }, { data: acesso, error: erroAcesso }, permissoes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("acessos_alunos").select("user_id").eq("user_id", userId).maybeSingle(),
      supabase.from("permissoes_professor").select("ativo").eq("chave", "presenca_registrar").maybeSingle(),
    ]);
        if (!active || !estaOnline()) return;
        const papeis = ((data ?? []) as { role: AppRole }[]).map((r) => r.role);
        setRoles(papeis);
        setIsStudent(!!acesso);
        setAcessoOffline(false);
        setChamadaOffline(false);
        if (!error && !erroAcesso && !permissoes.error) void salvarCache("acesso-local", { equipe: papeis.length > 0, chamada: papeis.includes("admin") || (papeis.includes("professor") && (permissoes.data?.ativo ?? true)) });
        setRolesLoading(false);
    };
    void carregar();
    window.addEventListener("online", carregar);
    window.addEventListener("offline", carregar);
    return () => {
      active = false;
      window.removeEventListener("online", carregar);
      window.removeEventListener("offline", carregar);
    };
  }, [session?.user?.id, usuarioLocalId]);

  return {
    session,
    loading: loading || rolesLoading,
    user: session?.user ?? null,
    roles,
    isAdmin: roles.includes("admin"),
    isStaff: roles.length > 0,
    isStudent,
    acessoOffline,
    chamadaOffline,
    usuarioLocalId,
  };
}
