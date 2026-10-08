import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuCheckboxItem, DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function FiltroRelatorio({ rotulo, opcoes, valores, multiplo, onChange }: {
  rotulo: string; opcoes: string[]; valores: string[]; multiplo: boolean; onChange: (valores: string[]) => void;
}) {
  return <div className="min-w-0 space-y-1">
    <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={valores.length ? "secondary" : "outline"} aria-label={`Filtro de ${rotulo}`} className="h-auto min-h-9 w-full justify-between text-left whitespace-normal">
          <span className="min-w-0 break-words">{valores.length ? valores.join(", ") : "Todos"}</span><ChevronDown className="size-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel>{rotulo}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onChange([])}>Todos / Limpar seleção</DropdownMenuItem>
        {opcoes.map((opcao) => <DropdownMenuCheckboxItem key={opcao} checked={valores.includes(opcao)}
          onSelect={(event) => { if (multiplo) event.preventDefault(); }}
          onCheckedChange={() => onChange(multiplo ? valores.includes(opcao) ? valores.filter((v) => v !== opcao) : [...valores, opcao] : valores.includes(opcao) ? [] : [opcao])}>
          {opcao}
        </DropdownMenuCheckboxItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}