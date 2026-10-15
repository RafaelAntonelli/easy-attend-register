import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type Turma = { id: string; nome: string; modalidade: string; horario: string | null; capacidade: number; dias_semana: string[] };

const SIGLAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const NOMES = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function siglaNormal(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 3).toLowerCase();
}

/** Turmas que têm aula no dia da semana atual, com ocupação e atalho para a chamada. */
export function AulasDoDia() {
  const navigate = useNavigate();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [ocupacao, setOcupacao] = useState<Record<string, number>>({});
  const [carregado, setCarregado] = useState(false);
  const agora = new Date();
  const dia = agora.getDay();

  useEffect(() => {
    void (async () => {
      const sigla = siglaNormal(SIGLAS[dia] ?? "");
      const [t, m] = await Promise.all([
        supabase.from("turmas").select("id,nome,modalidade,horario,capacidade,dias_semana").eq("ativa", true),
        supabase.from("matriculas").select("turma_id").eq("status", "ativa"),
      ]);
      const doDia = ((t.data ?? []) as Turma[])
        .filter((x) => x.dias_semana.some((d) => siglaNormal(d) === sigla))
        .sort((a, b) => (a.horario ?? "").localeCompare(b.horario ?? ""));
      const cont: Record<string, number> = {};
      for (const r of m.data ?? []) cont[r.turma_id] = (cont[r.turma_id] ?? 0) + 1;
      setTurmas(doDia);
      setOcupacao(cont);
      setCarregado(true);
    })();
  }, [dia]);

  function abrirChamada(id: string) {
    const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
    localStorage.setItem(
      "arena-aquatica:filtros-presenca",
      JSON.stringify({ data: hoje, turno: "todos", modalidade: "todas", dias: "todos", faixasEtarias: [], turmaIds: [id] }),
    );
    void navigate({ to: "/presenca" });
  }

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <CalendarDays className="size-5 text-primary" /> Aulas de hoje · {NOMES[dia]}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {carregado && !turmas.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma turma com aula hoje.</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {turmas.map((t) => {
              const n = ocupacao[t.id] ?? 0;
              return (
                <li key={t.id} className="flex items-center gap-3 rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                  <span className="w-12 shrink-0 font-display font-semibold">{t.horario?.slice(0, 5) ?? "--"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{t.nome}</p>
                    <div className="flex items-center gap-2">
                      <Progress value={(n / (t.capacidade || 40)) * 100} className="h-1.5" />
                      <span className="shrink-0 text-xs text-muted-foreground">{n}/{t.capacidade}</span>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => abrirChamada(t.id)}>Abrir chamada</Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
