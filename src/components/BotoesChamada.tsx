import { Check, FileCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

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
  disabled = false,
}: {
  atual: StatusChamada | null | undefined;
  onEscolher: (status: StatusChamada) => void;
  nome: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("grid w-full grid-cols-[1fr_0.8fr_1.25fr] gap-2 sm:w-auto sm:min-w-[22rem]", className)} role="group" aria-label={`Chamada de ${nome}`}>
      {OPCOES.map((o) => {
        const selecionado = atual === o.status;
        const Icone = o.icone;
        return (
          <Button
            variant="outline"
            disabled={disabled}
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
          </Button>
        );
      })}
    </div>
  );
}

/** "12 de 18 marcados" com barra de progresso. */
export function ProgressoChamada({ marcados, total, onVerAlunos }: { marcados: number; total: number; onVerAlunos?: () => void }) {
  const pct = total > 0 ? Math.round((marcados / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">Chamada</span>
        {onVerAlunos ? (
          <Button type="button" variant="link" className="h-auto whitespace-normal p-0 text-right text-sm" onClick={onVerAlunos} aria-label={`Ver alunos marcados: ${marcados} de ${total}`}>
            {marcados} de {total} marcado{total === 1 ? "" : "s"}
          </Button>
        ) : (
          <span className="text-muted-foreground">{marcados} de {total} marcado{total === 1 ? "" : "s"}</span>
        )}
      </div>
      <Progress value={pct} className="h-2" aria-label={`${marcados} de ${total} alunos marcados`} />
    </div>
  );
}

/** Resumo do dia: quantos vieram, faltaram, justificaram, estão de licença e ainda sem marcação. */
export type CategoriaResumoChamada = "Presentes" | "Faltas" | "Justificadas" | "Licença" | "Sem marcação";

export function ResumoChamada({ presentes, faltas, justificadas, licenca, semMarcacao, onVerAlunos }: { presentes: number; faltas: number; justificadas: number; licenca: number; semMarcacao: number; onVerAlunos?: (categoria: CategoriaResumoChamada) => void }) {
  const itens: [CategoriaResumoChamada, number, string][] = [
    ["Presentes", presentes, "text-success"],
    ["Faltas", faltas, "text-destructive"],
    ["Justificadas", justificadas, "text-warning-strong"],
    ["Licença", licenca, "text-primary"],
    ["Sem marcação", semMarcacao, "text-muted-foreground"],
  ];
  return (
    <dl className="mt-2 grid grid-cols-5 gap-1 text-center" aria-label="Resumo do dia">
      {itens.map(([rotulo, valor, cor]) => (
        <div key={rotulo} className="min-w-0 rounded-md bg-muted/50 px-1 py-1">
          <dt className="sr-only">{rotulo}</dt>
          <dd>
            {onVerAlunos ? (
              <Button type="button" variant="ghost" className="h-auto min-h-11 w-full flex-col gap-0 whitespace-normal px-0 py-1" onClick={() => onVerAlunos(rotulo)} aria-label={`Ver alunos: ${rotulo} (${valor})`}>
                <span className={`text-base font-semibold leading-tight ${cor}`}>{valor}</span>
                <span className="w-full text-[0.65rem] leading-tight text-muted-foreground">{rotulo}</span>
              </Button>
            ) : (
              <><span className={`block text-base font-semibold leading-tight ${cor}`}>{valor}</span><span className="block truncate text-[0.65rem] text-muted-foreground">{rotulo}</span></>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
