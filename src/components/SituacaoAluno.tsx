import { cn } from "@/lib/utils";

export type TomSituacao = "ativo" | "licenca" | "vencido" | "inativo";

const ESTILOS: Record<TomSituacao, { caixa: string; ponto: string }> = {
  ativo: { caixa: "bg-success/15 text-success-strong", ponto: "bg-success" },
  licenca: { caixa: "bg-warning/20 text-warning-strong", ponto: "bg-warning" },
  vencido: { caixa: "bg-destructive/12 text-destructive-strong", ponto: "bg-destructive" },
  inativo: { caixa: "bg-muted text-muted-foreground", ponto: "bg-muted-foreground" },
};

/** Etiqueta colorida da situação do aluno, com as mesmas cores em todas as telas. */
export function SituacaoAluno({ tom, rotulo, className }: { tom: TomSituacao; rotulo: string; className?: string }) {
  const e = ESTILOS[tom];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
        e.caixa,
        className,
      )}
    >
      <span className={cn("size-2 rounded-full", e.ponto)} aria-hidden />
      {rotulo}
    </span>
  );
}

export function pontoSituacao(tom: TomSituacao) {
  return ESTILOS[tom].ponto;
}
