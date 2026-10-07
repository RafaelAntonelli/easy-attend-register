import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { escolasDaRede } from "@/lib/escolas";
import { escolasPersonalizadasOptions, salvarEscolaPersonalizada } from "@/lib/escolas-personalizadas";
import { normalizarTexto } from "@/lib/formatacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export function SelecionarEscola({ rede, value, onChange }: {
  rede: string;
  value: string;
  onChange: (escola: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [novaEscola, setNovaEscola] = useState("");
  const [salvando, setSalvando] = useState(false);
  const queryClient = useQueryClient();
  const options = escolasPersonalizadasOptions(rede);
  const { data: personalizadas = [], isError } = useQuery(options);
  const adicionar = async () => {
    const nome = novaEscola.trim();
    if (!nome || salvando) return;
    setSalvando(true);
    try {
      const escola = await salvarEscolaPersonalizada(rede, nome);
      queryClient.setQueryData(options.queryKey, (atuais: string[] | undefined) => [...new Set([...(atuais ?? []), escola])]);
      void queryClient.invalidateQueries({ queryKey: options.queryKey });
      onChange(escola);
      setAdicionando(false);
      setNovaEscola("");
      toast.success("Escola salva na lista.");
    } catch {
      toast.error("Não foi possível salvar a escola na lista. Verifique a conexão e tente novamente.");
    } finally {
      setSalvando(false);
    }
  };
  const escolas = [...new Set([...escolasDaRede(rede), ...personalizadas])];
  const opcoes = value && !escolas.includes(value) ? [value, ...escolas] : escolas;

  return (
    <div className="space-y-2">
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
    {isError && <p role="alert" className="text-sm text-destructive">Não foi possível carregar as escolas adicionadas. Verifique a conexão.</p>}
    {adicionando ? (
      <div className="flex items-center gap-2">
        <Input autoFocus disabled={salvando} aria-label="Nome da escola fora da lista" placeholder="Nome da nova escola" value={novaEscola}
          className="min-w-0 flex-1" onChange={(event) => setNovaEscola(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") { event.preventDefault(); adicionar(); }
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setAdicionando(false); }
          }} />
        <Button type="button" size="icon" aria-label="Adicionar escola" title="Adicionar escola" disabled={salvando || !novaEscola.trim()} onClick={adicionar}>
          <Check />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label="Cancelar adição de escola" title="Cancelar" disabled={salvando} onClick={() => setAdicionando(false)}>
          <X />
        </Button>
      </div>
    ) : (
      <Button type="button" variant="link" className="h-auto max-w-full justify-start px-0 text-left whitespace-normal" onClick={() => { setNovaEscola(""); setAdicionando(true); }}>
        <Plus /> Adicionar escola fora da lista
      </Button>
    )}
    </div>
  );
}