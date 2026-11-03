import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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

/**
 * Liga/desliga a falta automática. A regra (15 min após o início, só alunos sem registro no dia,
 * fora de licença médica) roda no banco; aqui só administradores mudam a chave.
 */
export function FaltaAutomatica({ podeAlterar }: { podeAlterar: boolean }) {
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    let vivo = true;
    void supabase
      .from("configuracao_falta_automatica")
      .select("ativo")
      .maybeSingle()
      .then(({ data }) => {
        if (vivo) setAtivo(Boolean(data?.ativo));
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
              ? "Ligada: 15 minutos após o início de cada aula, quem ainda não tem registro recebe falta."
              : "Desligada. Quando ligada, quem não tiver registro 15 minutos após o início da aula recebe falta."}
          </p>
          {!podeAlterar && (
            <p className="mt-1 text-xs text-muted-foreground">Só administradores podem ligar ou desligar.</p>
          )}
        </div>
      </CardContent>

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ativar falta automática?</AlertDialogTitle>
            <AlertDialogDescription>
              Em todas as turmas, 15 minutos depois do início da aula, os alunos que ainda não tiverem presença
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
