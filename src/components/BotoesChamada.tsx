import { Check, FileCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export type StatusChamada = "presente" | "falta" | "falta_justificada";

const OPCOES: { status: StatusChamada; rotulo: string; icone: typeof Check; ativo: string; inativo: string }[] = [
  {
    status: "presente",
    rotulo: "Presente",
    icone: Check,
    ativo: "border-success bg-success text-success-foreground shadow-sm",
    inativo: "border-success/50 text-success-strong hover:bg-success/10",
  },
  {
    status: "falta",
    rotulo: "Falta",
    icone: X,
    ativo: "border-destructive bg-destructive text-destructive-foreground shadow-sm",
    inativo: "border-destructive/50 text-destructive-strong hover:bg-destructive/10",
  },
  {
    status: "falta_justificada",
    rotulo: "Justificada",
    icone: FileCheck,
    ativo: "border-warning bg-warning text-warning-foreground shadow-sm",
    inativo: "border-warning/60 text-warning-strong hover:bg-warning/10",
  },
];

/** Botões grandes de chamada, fáceis de tocar no celular. */
export function BotoesChamada({
  atual,
  onEscolher,
  nome,
  className,
}: {
  atual: StatusChamada | null | undefined;
  onEscolher: (status: StatusChamada) => void;
  nome: string;
  className?: string;
}) {
  return (
    <div className={cn("grid w-full grid-cols-[1fr_0.8fr_1.25fr] gap-2 sm:w-auto sm:min-w-[22rem]", className)} role="group" aria-label={`Chamada de ${nome}`}>
      {OPCOES.map((o) => {
        const selecionado = atual === o.status;
        const Icone = o.icone;
        return (
          <button
            key={o.status}
            type="button"
            aria-pressed={selecionado}
            onClick={() => onEscolher(o.status)}
            className={cn(
              "flex min-h-11 items-center justify-center gap-1 rounded-xl border-2 px-1.5 text-[13px] font-semibold sm:gap-1.5 sm:px-2 sm:text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selecionado ? o.ativo : cn("bg-card", o.inativo),
            )}
          >
            <Icone className="hidden size-4 shrink-0 min-[400px]:block" />
            <span className="truncate">{o.rotulo}</span>
          </button>
        );
      })}
    </div>
  );
}

/** "12 de 18 marcados" com barra de progresso. */
export function ProgressoChamada({ marcados, total }: { marcados: number; total: number }) {
  const pct = total > 0 ? Math.round((marcados / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">Chamada</span>
        <span className="text-muted-foreground">
          {marcados} de {total} marcado{total === 1 ? "" : "s"}
        </span>
      </div>
      <Progress value={pct} className="h-2" aria-label={`${marcados} de ${total} alunos marcados`} />
    </div>
  );
}
