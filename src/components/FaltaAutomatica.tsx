import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Prazos oferecidos (o banco aceita de 5 a 60 minutos). */
const OPCOES_MINUTOS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];

/**
 * Liga/desliga a falta automática e define o prazo em minutos. A regra (prazo após o início,
 * só alunos sem registro no dia, fora de licença médica) roda no banco; só administradores mudam.
 */
export function FaltaAutomatica({ podeAlterar }: { podeAlterar: boolean }) {
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [minutos, setMinutos] = useState(15);
  const [salvando, setSalvando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    let vivo = true;
    void supabase
      .from("configuracao_falta_automatica")
      .select("ativo, minutos")
      .maybeSingle()
      .then(({ data }) => {
        if (!vivo) return;
        setAtivo(Boolean(data?.ativo));
        if (data?.minutos) setMinutos(data.minutos);
      });
    return () => {
      vivo = false;
    };
  }, []);

  async function salvar(novo: boolean) {
    setSalvando(true);
    const { error } = await supabase.rpc("definir_falta_automatica", { _ativo: novo });
    setSalvando(false);
    if (error) {
      toast.error("Não foi possível alterar a falta automática. Tente de novo.");
      return;
    }
    setAtivo(novo);
    toast.success(novo ? "Falta automática ativada" : "Falta automática desativada");
  }

  async function salvarMinutos(novo: number) {
    const anterior = minutos;
    setMinutos(novo);
    setSalvando(true);
    const { error } = await supabase.rpc("definir_minutos_falta_automatica", { _minutos: novo });
    setSalvando(false);
    if (error) {
      setMinutos(anterior);
      toast.error("Não foi possível alterar os minutos. Tente de novo.");
      return;
    }
    toast.success(`Falta automática: ${novo} minutos após o início da aula`);
  }

  if (ativo === null) return null;

  return (
    <Card className="border-border/70">
      <CardContent className="flex items-start gap-3 pt-6">
        <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Clock className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="falta-automatica" className="font-display font-semibold">
              Falta automática
            </label>
            <Switch
              id="falta-automatica"
              checked={ativo}
              disabled={!podeAlterar || salvando}
              onCheckedChange={(v) => (v ? setConfirmar(true) : void salvar(false))}
              aria-label="Ativar falta automática"
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {ativo
              ? `Ligada: ${minutos} minutos após o início de cada aula, quem ainda não tem registro recebe falta.`
              : `Desligada. Quando ligada, quem não tiver registro ${minutos} minutos após o início da aula recebe falta.`}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="whitespace-nowrap text-sm">Marcar falta após</span>
            <Select
              value={String(minutos)}
              onValueChange={(v) => void salvarMinutos(Number(v))}
              disabled={!podeAlterar || salvando}
            >
              <SelectTrigger className="h-8 w-[7.5rem]" aria-label="Minutos após o início da aula">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPCOES_MINUTOS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} minutos
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="whitespace-nowrap text-sm text-muted-foreground">do início da aula</span>
          </div>
          {!podeAlterar && (
            <p className="mt-2 text-xs text-muted-foreground">Só administradores podem mudar.</p>
          )}
        </div>
      </CardContent>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ativar falta automática?</AlertDialogTitle>
            <AlertDialogDescription>
              Em todas as turmas, {minutos} minutos depois do início da aula, os alunos que ainda não tiverem presença
              registrada no dia recebem falta. Quem está de licença médica não recebe falta. Se o aluno chegar
              depois, é só marcar Presente que a falta é substituída. Em feriados ou aulas canceladas, desligue
              antes do horário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void salvar(true)}>Ativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
