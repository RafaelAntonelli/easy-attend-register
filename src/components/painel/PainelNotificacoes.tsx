import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Bell, ChevronDown, ChevronUp, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { diasParaVencer, notificarAtestadoVencendo, notificarAtestadoVencido } from "@/lib/atestado";
import { usePrazoAvisoAtestado } from "@/lib/configuracoes";
import { ConversarWhatsApp } from "@/components/ConversarWhatsApp";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type AlunoNotif = {
  id: string;
  nome: string;
  telefone: string | null;
  ativo: boolean;
  atestado_entregue: boolean;
  atestado_data: string | null;
  motivo_inativacao: string | null;
  inativado_em: string | null;
};

export type TipoNotificacao = "inativos" | "sem_atestado" | "atestado_vencido" | "atestado_vencer" | "excesso_faltas";

/** Notificações de alunos exibidas no Painel; clicar no quadro abre Alunos já filtrado. */
export function PainelNotificacoes({ onAbrirPerfil }: { onAbrirPerfil: (id: string) => void }) {
  const { valor: prazoAviso } = usePrazoAvisoAtestado();
  const [alunos, setAlunos] = useState<AlunoNotif[]>([]);
  const [faltas, setFaltas] = useState<Record<string, number>>({});
  const [abertas, setAbertas] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void supabase
      .from("alunos")
      .select("id,nome,telefone,ativo,atestado_entregue,atestado_data,motivo_inativacao,inativado_em")
      .order("nome")
      .then(({ data }) => setAlunos((data ?? []) as AlunoNotif[]));
    void supabase
      .from("presencas")
      .select("aluno_id")
      .eq("status", "falta")
      .then(({ data }) => {
        const c: Record<string, number> = {};
        for (const r of (data ?? []) as { aluno_id: string }[]) c[r.aluno_id] = (c[r.aluno_id] ?? 0) + 1;
        setFaltas(c);
      });
  }, []);

  const inativos = alunos.filter((a) => !a.ativo);
  const semAtestado = alunos.filter((a) => !a.atestado_entregue);
  const vencidos = alunos.filter(notificarAtestadoVencido);
  const vencendo = alunos.filter((a) => notificarAtestadoVencendo(a, prazoAviso));
  const excesso = alunos.filter((a) => a.ativo && (faltas[a.id] ?? 0) >= 5);

  const Quadro = ({
    tipo, titulo, icone, lista, detalhe, classe, cor,
  }: {
    tipo: TipoNotificacao; titulo: string; icone: ReactNode; lista: AlunoNotif[];
    detalhe: (a: AlunoNotif) => string; classe: string; cor: string;
  }) => {
    if (!lista.length) return null;
    const aberta = !!abertas[tipo];
    return (
      <Card
        className={cn("mb-6", classe)}
      >
        <CardContent className="space-y-2 py-4">
          <div className="flex items-center justify-between gap-2">
            <p className={cn("flex items-center gap-2 font-medium", cor)}>{icone} {titulo}</p>
            <Button
              variant="ghost"
              size="icon"
              title={aberta ? "Esconder lista" : "Mostrar lista"}
              onClick={(e) => { e.stopPropagation(); setAbertas((s) => ({ ...s, [tipo]: !aberta })); }}
            >
              {aberta ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>
          </div>
          {aberta ? (
            <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {lista.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-card px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => onAbrirPerfil(a.id)}
                    className="h-auto min-w-0 flex-1 flex-wrap justify-between gap-2 whitespace-normal px-0 py-1 text-left text-sm"
                  >
                    <span>{a.nome}</span>
                    <span className="text-right text-xs text-muted-foreground">{detalhe(a)}</span>
                  </Button>
                  <ConversarWhatsApp telefone={a.telefone} />
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    );
  };

  const dataBR = (d: string | null) => (d ? new Date(d.length <= 10 ? `${d}T00:00:00` : d).toLocaleDateString("pt-BR") : "-");

  return (
    <div>
      <Quadro tipo="inativos" titulo={`${inativos.length} aluno(s) inativo(s)`} icone={<UserX className="size-4" />} lista={inativos}
        detalhe={(a) => `${a.motivo_inativacao ?? "Sem turma"}${a.inativado_em ? ` · ${dataBR(a.inativado_em)}` : ""}`}
        classe="border-muted-foreground/30 bg-muted/40" cor="text-muted-foreground" />
      <Quadro tipo="sem_atestado" titulo={`${semAtestado.length} aluno(s) sem atestado médico`} icone={<Bell className="size-4" />} lista={semAtestado}
        detalhe={() => "Atestado não entregue"} classe="border-primary/40 bg-primary/5" cor="text-primary" />
      <Quadro tipo="atestado_vencido" titulo={`${vencidos.length} atestado(s) vencido(s)`} icone={<Bell className="size-4" />} lista={vencidos}
        detalhe={(a) => `Atestado de ${dataBR(a.atestado_data)}`} classe="border-destructive/40 bg-destructive/5" cor="text-destructive" />
      <Quadro tipo="atestado_vencer" titulo={`${vencendo.length} atestado(s) vencendo em até ${prazoAviso} dias`} icone={<Bell className="size-4" />} lista={vencendo}
        detalhe={(a) => `Vence em ${diasParaVencer(a.atestado_data)} dia(s)`} classe="border-accent/60 bg-accent/10" cor="text-foreground" />
      <Quadro tipo="excesso_faltas" titulo={`${excesso.length} aluno(s) com 5 faltas ou mais`} icone={<AlertTriangle className="size-4" />} lista={excesso}
        detalhe={(a) => `${faltas[a.id]} faltas`} classe="border-accent/60 bg-accent/10" cor="text-foreground" />
    </div>
  );
}
