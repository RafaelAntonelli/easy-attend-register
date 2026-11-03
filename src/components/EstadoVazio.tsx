import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Tela vazia com orientação: ícone, frase curta, explicação e o botão do que fazer. */
export function EstadoVazio({
  icone: Icone,
  titulo,
  descricao,
  children,
  className,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-10 text-center", className)}>
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Icone className="size-6" />
      </div>
      <p className="font-display font-semibold text-foreground">{titulo}</p>
      {descricao ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{descricao}</p> : null}
      {children ? <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}
