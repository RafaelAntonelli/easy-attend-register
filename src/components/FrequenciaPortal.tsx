import { queryOptions, useQuery } from '@tanstack/react-query';
import { CalendarCheck } from 'lucide-react';
import { obterFrequenciaPortal } from '@/lib/portal-extras.functions';
import { tokenAparelhoLocal } from '@/lib/aparelho-local';
import { cn } from '@/lib/utils';

export const frequenciaPortalConsulta = queryOptions({ queryKey: ['frequencia-portal'], queryFn: () => obterFrequenciaPortal({ data: { aparelho: tokenAparelhoLocal() } }) });

const ROTULO = { presente: 'Presença', falta: 'Falta', falta_justificada: 'Justificada' } as const;
const COR = { presente: 'bg-success/15 text-success-strong', falta: 'bg-destructive/10 text-destructive', falta_justificada: 'bg-warning/15 text-warning-strong' } as const;

/** Presenças, faltas e faltas justificadas do próprio aluno no mês atual. */
export function FrequenciaPortal() {
  const { data, isError, isLoading } = useQuery(frequenciaPortalConsulta);
  const mes = data ? new Date(`${data.inicio}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long' }) : '';
  const total = data ? data.presencas + data.faltas + data.justificadas : 0;
  const pct = data && total ? Math.round((data.presencas / total) * 100) : null;
  return (
    <section aria-labelledby="titulo-frequencia">
      <div className="mb-4 flex items-center gap-2"><CalendarCheck className="size-5 text-primary" /><h2 id="titulo-frequencia" className="font-display text-base font-semibold">Minha frequência{mes ? ` em ${mes}` : ''}</h2></div>
      {isError ? <p role="alert" className="text-sm text-destructive">Não foi possível carregar sua frequência.</p>
        : isLoading || !data ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : <>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-success/10 py-2"><dt className="text-xs text-muted-foreground">Presenças</dt><dd className="font-display text-xl font-semibold text-success-strong">{data.presencas}</dd></div>
            <div className="rounded-md bg-destructive/10 py-2"><dt className="text-xs text-muted-foreground">Faltas</dt><dd className="font-display text-xl font-semibold text-destructive">{data.faltas}</dd></div>
            <div className="rounded-md bg-warning/10 py-2"><dt className="text-xs text-muted-foreground">Justificadas</dt><dd className="font-display text-xl font-semibold text-warning-strong">{data.justificadas}</dd></div>
          </dl>
          <p className="mt-3 text-sm text-muted-foreground">{pct === null ? 'Nenhuma aula registrada neste mês ainda.' : `Você veio a ${pct}% das aulas registradas neste mês.`}</p>
          {data.registros.length > 0 && <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Aulas do mês">
            {data.registros.map((r) => <li key={r.data} className={cn('rounded-md px-2 py-1 text-xs font-medium', COR[r.status])} title={ROTULO[r.status]}>{new Date(`${r.data}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · {ROTULO[r.status]}</li>)}
          </ul>}
        </>}
    </section>
  );
}
