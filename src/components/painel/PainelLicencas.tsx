import { useEffect, useState } from "react";
import { HeartPulse } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { dataBR, hojeISO, licencaEmVigor, retornoPendente, type Licenca } from "@/lib/licenca";

type Item = Licenca & { alunos: { nome: string; ativo: boolean } | null };

function somarDias(iso: string, dias: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Licenças em andamento e retornos previstos para os próximos 7 dias. */
export function PainelLicencas({ onAbrirPerfil }: { onAbrirPerfil: (id: string) => void }) {
  const [itens, setItens] = useState<Item[]>([]);

  useEffect(() => {
    void supabase
      .from("licencas_medicas")
      .select("id,aluno_id,data_inicio,data_retorno,motivo,encerrada_em,alunos(nome,ativo)")
      .is("encerrada_em", null)
      .order("data_retorno")
      .then(({ data }) => setItens(((data ?? []) as unknown as Item[]).filter((i) => i.alunos?.ativo)));
  }, []);

  const hoje = hojeISO();
  const limite = somarDias(hoje, 7);
  const pendentes = itens.filter((i) => retornoPendente(i, hoje));
  const semana = itens.filter((i) => licencaEmVigor(i, hoje) && i.data_retorno <= limite);
  const afastados = itens.filter((i) => licencaEmVigor(i, hoje) && i.data_retorno > limite);

  const Linha = ({ i, rotulo, tom }: { i: Item; rotulo: string; tom: "destructive" | "secondary" | "outline" }) => (
    <li className="flex items-center justify-between gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-sm">
      <button type="button" className="truncate text-left font-medium hover:underline" onClick={() => onAbrirPerfil(i.aluno_id)}>
        {i.alunos?.nome}
      </button>
      <Badge variant={tom} className="shrink-0">{rotulo}</Badge>
    </li>
  );

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <HeartPulse className="size-5 text-primary" /> Licenças e retornos da semana
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!itens.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum aluno em licença médica.</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {pendentes.map((i) => <Linha key={i.id} i={i} tom="destructive" rotulo={`Confirmar retorno (${dataBR(i.data_retorno)})`} />)}
            {semana.map((i) => <Linha key={i.id} i={i} tom="secondary" rotulo={`Retorna ${dataBR(i.data_retorno)}`} />)}
            {afastados.map((i) => <Linha key={i.id} i={i} tom="outline" rotulo={`Afastado até ${dataBR(i.data_retorno)}`} />)}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
