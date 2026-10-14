import { useEffect, useState } from "react";
import { HeartPulse } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { dataBR, hojeISO, licencaEmVigor, retornoPendente, type Licenca } from "@/lib/licenca";

type Item = Licenca & { alunos: { nome: string; ativo: boolean } | null };

/** Avisos de licença médica: alunos afastados e retornos previstos que chegaram. */
export function AvisoLicencas({ onAbrirPerfil }: { onAbrirPerfil?: (id: string) => void }) {
  const [itens, setItens] = useState<Item[]>([]);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    void supabase
      .from("licencas_medicas")
      .select("id,aluno_id,data_inicio,data_retorno,motivo,encerrada_em,alunos(nome,ativo)")
      .is("encerrada_em", null)
      .order("data_retorno")
      .then(({ data }) => setItens(((data ?? []) as unknown as Item[]).filter((i) => i.alunos?.ativo)));
  }, []);

  const hoje = hojeISO();
  const retornos = itens.filter((i) => retornoPendente(i, hoje));
  const afastados = itens.filter((i) => licencaEmVigor(i, hoje));
  if (!retornos.length && !afastados.length) return null;

  return (
    <Card className="mb-6 border-primary/40 bg-primary/5">
      <CardContent className="space-y-2 py-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-medium text-primary">
            <HeartPulse className="size-4" /> Licença médica · {afastados.length} afastado(s)
            {retornos.length ? ` · ${retornos.length} com retorno previsto` : ""}
          </p>
          <Button size="sm" variant="ghost" onClick={() => setAberto((v) => !v)}>
            {aberto ? "Esconder" : "Mostrar"}
          </Button>
        </div>
        {aberto ? (
          <ul className="space-y-1 text-sm">
            {retornos.map((i) => (
              <li key={i.id}>
                <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => onAbrirPerfil?.(i.aluno_id)}>
                  {i.alunos?.nome}
                </button>{" "}
                <span className="text-muted-foreground">— retorno previsto em {dataBR(i.data_retorno)}: confirme a volta ou prorrogue</span>
              </li>
            ))}
            {afastados.map((i) => (
              <li key={i.id}>
                <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => onAbrirPerfil?.(i.aluno_id)}>
                  {i.alunos?.nome}
                </button>{" "}
                <span className="text-muted-foreground">— afastado até {dataBR(i.data_retorno)}{i.motivo ? ` (${i.motivo})` : ""}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
