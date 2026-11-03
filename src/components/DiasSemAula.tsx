import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, CalendarOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { chaveDia } from "@/lib/data-presenca";
import { dataBR } from "@/lib/licenca";
import { proximosDiasSemAula, type DiaSemAula } from "@/lib/dias-sem-aula";

const TODAS = "todas";

/** Calendário de dias sem aula. Todos da equipe veem; só administradores cadastram e removem. */
export function DiasSemAula({
  lista,
  turmas,
  podeAlterar,
  onMudou,
}: {
  lista: DiaSemAula[];
  turmas: { id: string; nome: string }[];
  podeAlterar: boolean;
  onMudou: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState<Date | undefined>(undefined);
  const [turmaId, setTurmaId] = useState(TODAS);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [verTodos, setVerTodos] = useState(false);

  const hoje = chaveDia(new Date());
  const proximos = proximosDiasSemAula(lista, hoje);
  const mostrados = verTodos ? proximos : proximos.slice(0, 3);
  const nomeTurma = (id: string | null) => (id ? turmas.find((t) => t.id === id)?.nome ?? "Turma" : "Todas as turmas");

  function abrir() {
    setData(undefined);
    setTurmaId(TODAS);
    setMotivo("");
    setAberto(true);
  }

  async function salvar() {
    if (!data) return toast.error("Escolha a data.");
    if (!motivo.trim()) return toast.error("Escreva o motivo (ex.: Feriado).");
    setSalvando(true);
    const { error } = await supabase.from("dias_sem_aula").insert({
      data: chaveDia(data),
      turma_id: turmaId === TODAS ? null : turmaId,
      motivo: motivo.trim(),
    });
    setSalvando(false);
    if (error) {
      toast.error(error.code === "23505" ? "Esse dia já está cadastrado para essa turma." : "Não foi possível salvar. Tente de novo.");
      return;
    }
    toast.success("Dia sem aula cadastrado");
    setAberto(false);
    onMudou();
  }

  async function remover(d: DiaSemAula) {
    const { error } = await supabase.from("dias_sem_aula").delete().eq("id", d.id);
    if (error) return toast.error("Não foi possível remover. Tente de novo.");
    toast.success("Dia sem aula removido");
    onMudou();
  }

  return (
    <Card className="border-border/70">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <CalendarOff className="size-5 text-primary" /> Dias sem aula
        </CardTitle>
        {podeAlterar ? (
          <Button size="sm" variant="outline" onClick={abrir}>
            <Plus className="size-4" /> Adicionar
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {mostrados.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="font-medium">
                {dataBR(d.data)} · {d.motivo}
              </p>
              <p className="truncate text-xs text-muted-foreground">{nomeTurma(d.turma_id)}</p>
            </div>
            {podeAlterar ? (
              <Button variant="ghost" size="icon" className="size-8 shrink-0 text-destructive" aria-label={`Remover dia sem aula ${dataBR(d.data)}`} onClick={() => void remover(d)}>
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
        ))}
        {proximos.length > 3 ? (
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setVerTodos((v) => !v)}>
            {verTodos ? "Mostrar menos" : `Ver todos (${proximos.length})`}
          </Button>
        ) : null}
        {!proximos.length ? (
          <p className="text-sm text-muted-foreground">
            Nenhum feriado ou aula cancelada pela frente.{" "}
            {podeAlterar ? "Cadastre aqui para a falta automática não marcar ninguém nesses dias." : null}
          </p>
        ) : (
          <p className="pt-1 text-xs text-muted-foreground">Nesses dias a falta automática não marca ninguém.</p>
        )}
      </CardContent>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Adicionar dia sem aula</DialogTitle>
            <DialogDescription>
              Feriado, recesso ou aula cancelada. Se já houver faltas automáticas nesse dia, elas são apagadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="size-4" />
                    {data ? format(data, "PPP", { locale: ptBR }) : "Escolha a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" locale={ptBR} selected={data} onSelect={setData} initialFocus className="pointer-events-auto p-3" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Turmas</Label>
              <Select value={turmaId} onValueChange={setTurmaId}>
                <SelectTrigger aria-label="Turmas sem aula">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value={TODAS}>Todas as turmas</SelectItem>
                  {turmas.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="motivo-sem-aula">Motivo</Label>
              <Input id="motivo-sem-aula" maxLength={200} placeholder="Ex.: Feriado da Consciência Negra" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </div>
            <Button className="w-full" disabled={salvando} onClick={() => void salvar()}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
