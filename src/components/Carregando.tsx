import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Linhas cinza no lugar de uma lista de alunos enquanto ela carrega. */
export function CarregandoLinhas({
  linhas = 5,
  comBotoes = false,
  fotoGrande = false,
  className,
}: {
  linhas?: number;
  comBotoes?: boolean;
  fotoGrande?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)} role="status" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3">
          <Skeleton className={cn("shrink-0 rounded-full", fotoGrande ? "size-20 sm:size-16" : "size-11")} />
          <div className="min-w-40 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          {comBotoes ? <Skeleton className="h-11 w-full rounded-xl sm:w-[22rem]" /> : null}
        </div>
      ))}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

/** Cartões cinza no lugar das turmas enquanto elas carregam. */
export function CarregandoCartoes({ quantidade = 6, className }: { quantidade?: number; className?: string }) {
  return (
    <>
      {Array.from({ length: quantidade }, (_, i) => (
        <div key={i} className={cn("space-y-3 overflow-hidden rounded-xl border border-border/70 bg-card", className)} role="status" aria-label="Carregando">
          <Skeleton className="h-1.5 w-full rounded-none" />
          <div className="space-y-3 p-6 pt-5">
            <div className="flex justify-between gap-3">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-5 w-10" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      ))}
    </>
  );
}
