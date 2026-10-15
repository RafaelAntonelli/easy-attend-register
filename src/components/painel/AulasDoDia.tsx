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
    void navigate({ to: "/turmas", search: { turma: id } });
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
              const pct = (n / (t.capacidade || 40)) * 100;
              const cor = pct >= 100 ? "[&>div]:bg-destructive" : pct >= 80 ? "[&>div]:bg-warning" : "[&>div]:bg-accent";
              return (
                <li key={t.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-3 text-sm transition-shadow hover:shadow-pool">
                  <span className="grid w-14 shrink-0 place-items-center rounded-lg bg-secondary py-1.5 font-display font-semibold text-secondary-foreground">{t.horario?.slice(0, 5) ?? "--"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{t.nome}</p>
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className={`h-1.5 ${cor}`} />
                      <span className="shrink-0 text-xs text-muted-foreground">{n}/{t.capacidade}</span>
                    </div>
                  </div>
                  <Button size="sm" className="bg-pool text-primary-foreground hover:opacity-90" onClick={() => abrirChamada(t.id)}>Abrir chamada</Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
