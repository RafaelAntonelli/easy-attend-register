import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { escolasDaRede } from "@/lib/escolas";
import { normalizarTexto } from "@/lib/formatacao";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export function SelecionarEscola({ rede, value, onChange }: {
  rede: string;
  value: string;
  onChange: (escola: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const escolas = escolasDaRede(rede);
  const opcoes = value && !escolas.includes(value) ? [value, ...escolas] : escolas;

  return (
    <Popover open={aberto} onOpenChange={setAberto} modal>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-label="Nome da escola" aria-expanded={aberto}
          className="h-auto min-h-9 w-full justify-between px-3 font-normal whitespace-normal text-left">
          <span className="min-w-0 break-words">{value || "Selecione a escola"}</span>
          <ChevronsUpDown className="shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0">
        <Command filter={(nome, busca) => normalizarTexto(busca).split(" ").filter(Boolean).every((termo) => normalizarTexto(nome).includes(termo)) ? 1 : 0}>
          <CommandInput placeholder="Pesquisar escola..." aria-label="Pesquisar escola" />
          <CommandList className="max-h-[min(300px,var(--radix-popover-content-available-height))]">
            <CommandEmpty>Nenhuma escola encontrada.</CommandEmpty>
            <CommandGroup>
              {opcoes.map((escola) => (
                <CommandItem key={escola} value={escola} onSelect={() => { onChange(escola); setAberto(false); }}
                  className="items-start whitespace-normal break-words">
                  <Check className={value === escola ? "shrink-0 opacity-100" : "shrink-0 opacity-0"} />
                  <span className="min-w-0">{escola}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}