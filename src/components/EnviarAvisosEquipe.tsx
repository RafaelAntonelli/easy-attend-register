import { useCallback, useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { CalendarClock, CheckCheck, ChevronDown, ChevronUp, Clock, Send, Users, UserRound, Layers, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { enviarAvisoEquipe, cancelarAvisoAgendado } from '@/lib/portal-extras.functions';
import { erroAgendamento } from '@/lib/portal-extras';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type Destino = 'aluno' | 'turma' | 'todos';
type Envio = { envio_id: string; titulo: string; mensagem: string; criado_em: string; agendado_para: string | null; destino: string | null; turma: string | null; autor: string | null; total: number; lidos: number };
type Leitor = { id: string; lido_em: string | null; alunos: { nome: string; codigo: string } | null };

const dataHora = (v: string) => new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
/** Valor para o campo de data e hora no fuso do aparelho. */
function paraCampoLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function EnviarAvisosEquipe() {
  const [destino, setDestino] = useState<Destino>('aluno');
  const [busca, setBusca] = useState('');
  const [alunos, setAlunos] = useState<{ id: string; nome: string; codigo: string }[]>([]);
  const [selecionado, setSelecionado] = useState<{ id: string; nome: string } | null>(null);
  const [turmas, setTurmas] = useState<{ id: string; nome: string }[]>([]);
  const [turmaId, setTurmaId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [agendar, setAgendar] = useState(false);
  const [quando, setQuando] = useState('');
  const [busy, setBusy] = useState(false);
  const [resultado, setResultado] = useState('');
  const [envios, setEnvios] = useState<Envio[] | null>(null);
  const enviar = useServerFn(enviarAvisoEquipe);
  const cancelar = useServerFn(cancelarAvisoAgendado);

  const carregarEnvios = useCallback(async () => {
    const { data, error } = await supabase.rpc('envios_avisos', { _limite: 50 });
    if (error) { toast.error('Não foi possível carregar os avisos enviados.'); setEnvios([]); return; }
    setEnvios((data ?? []) as Envio[]);
  }, []);

  useEffect(() => {
    void carregarEnvios();
    void supabase.from('turmas').select('id,nome').eq('ativa', true).order('nome').then(({ data }) => setTurmas(data ?? []));
  }, [carregarEnvios]);

  const turmaNome = turmas.find((t) => t.id === turmaId)?.nome;
  const pronto = destino === 'todos' || (destino === 'aluno' ? !!selecionado : !!turmaId);
  const descricaoDestino = destino === 'todos' ? 'todos os alunos' : destino === 'turma' ? `a turma ${turmaNome ?? ''}` : selecionado?.nome ?? '';

  async function buscarAlunos() {
    const termo = busca.replace(/[%_,().]/g, ' ').trim();
    if (termo.length < 2) return;
    const { data, error } = await supabase.from('alunos').select('id,nome,codigo').or(`nome.ilike.%${termo}%,codigo.ilike.%${termo}%`).order('nome').limit(20);
    if (error) toast.error('Falha ao buscar.'); else setAlunos(data ?? []);
  }

  async function onEnviar(e: React.FormEvent) {
    e.preventDefault();
    if (!pronto) return;
    const agendadoPara = agendar && quando ? new Date(quando).toISOString() : null;
    if (agendar) {
      const erro = !quando ? 'Escolha o dia e o horário do aviso.' : erroAgendamento(agendadoPara);
      if (erro) { toast.error(erro); return; }
    }
    const confirmacao = agendadoPara
      ? `Agendar este aviso para ${descricaoDestino} em ${dataHora(agendadoPara)}?`
      : `Enviar este aviso agora para ${descricaoDestino}?`;
    if (!window.confirm(confirmacao)) return;
    setBusy(true);
    try {
      const r = await enviar({ data: { destino, alunoId: destino === 'aluno' ? selecionado?.id ?? null : null, turmaId: destino === 'turma' ? turmaId : null, titulo, mensagem, agendadoPara } });
      if (r.agendado) {
        setResultado(`Aviso agendado para ${r.destinatarios} aluno(s). Ele aparece na área do aluno em ${dataHora(agendadoPara!)}${r.pushIndisponivel ? '. A notificação no celular não pôde ser agendada, mas o aviso aparece na central de avisos.' : ', com notificação no celular para quem ativou.'}`);
        toast.success('Aviso agendado.');
      } else {
        setResultado(`Aviso salvo para ${r.destinatarios} aluno(s) e exibido na área do aluno. Notificações enviadas ao celular: ${r.enviados}.${r.falhas ? ` Falhas de entrega: ${r.falhas}.` : ''}${r.pushIndisponivel ? ' As notificações no celular estão indisponíveis agora, mas o aviso está garantido na central de avisos da área do aluno.' : r.enviados === 0 ? ' Nenhum destinatário ativou as notificações no aparelho ainda; o aviso aparece na central de avisos da área do aluno.' : ''}`);
        toast.success('Aviso enviado.');
      }
      setTitulo(''); setMensagem(''); setAgendar(false); setQuando('');
      void carregarEnvios();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Falha ao enviar.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="space-y-5">
        <h2 className="font-display text-xl font-semibold">Enviar aviso aos alunos</h2>
        <div className="space-y-2">
          <Label>Para quem</Label>
          <ToggleGroup type="single" variant="outline" value={destino} onValueChange={(v) => v && setDestino(v as Destino)} className="flex w-full flex-wrap justify-start">
            <ToggleGroupItem value="aluno" className="flex-1 gap-2"><UserRound className="size-4" />Um aluno</ToggleGroupItem>
            <ToggleGroupItem value="turma" className="flex-1 gap-2"><Layers className="size-4" />Uma turma</ToggleGroupItem>
            <ToggleGroupItem value="todos" className="flex-1 gap-2"><Users className="size-4" />Todos</ToggleGroupItem>
          </ToggleGroup>
        </div>
        {destino === 'aluno' && (
          <div className="space-y-2">
            <Label htmlFor="aviso-busca">Aluno</Label>
            <div className="flex gap-2">
              <Input id="aviso-busca" value={busca} onChange={(e) => { setBusca(e.target.value); setSelecionado(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void buscarAlunos(); } }} placeholder="Nome ou matrícula" />
              <Button type="button" variant="outline" onClick={() => void buscarAlunos()}>Buscar</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {alunos.map((a) => <Button type="button" variant={selecionado?.id === a.id ? 'default' : 'outline'} key={a.id} onClick={() => setSelecionado(a)}>{a.nome} · {a.codigo}</Button>)}
            </div>
          </div>
        )}
        {destino === 'turma' && (
          <div className="space-y-2">
            <Label>Turma</Label>
            <Select value={turmaId} onValueChange={setTurmaId}>
              <SelectTrigger aria-label="Turma do aviso"><SelectValue placeholder="Escolha a turma" /></SelectTrigger>
              <SelectContent className="max-h-80">{turmas.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Recebem os alunos ativos matriculados nessa turma.</p>
          </div>
        )}
        <form className="space-y-4" onSubmit={onEnviar}>
          <div className="space-y-2"><Label htmlFor="aviso-titulo">Título</Label><Input id="aviso-titulo" required maxLength={100} value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="aviso-mensagem">Mensagem</Label><Textarea id="aviso-mensagem" required maxLength={1000} value={mensagem} onChange={(e) => setMensagem(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>Quando enviar</Label>
            <ToggleGroup type="single" variant="outline" value={agendar ? 'agendar' : 'agora'} onValueChange={(v) => { if (!v) return; setAgendar(v === 'agendar'); if (v === 'agendar' && !quando) setQuando(paraCampoLocal(new Date(Date.now() + 60 * 60_000))); }} className="flex w-full justify-start">
              <ToggleGroupItem value="agora" className="flex-1 gap-2"><Send className="size-4" />Agora</ToggleGroupItem>
              <ToggleGroupItem value="agendar" className="flex-1 gap-2"><CalendarClock className="size-4" />Agendar</ToggleGroupItem>
            </ToggleGroup>
            {agendar && (
              <div className="space-y-1">
                <Input type="datetime-local" aria-label="Dia e horário do aviso" value={quando} min={paraCampoLocal(new Date(Date.now() + 5 * 60_000))} onChange={(e) => setQuando(e.target.value)} />
                <p className="text-xs text-muted-foreground">O aviso aparece para os alunos nesse dia e horário. Você pode cancelar antes disso.</p>
              </div>
            )}
          </div>
          <Button type="submit" variant="pool" disabled={busy || !pronto}>
            {agendar ? <CalendarClock className="mr-2 size-4" /> : <Send className="mr-2 size-4" />}
            {busy ? 'Enviando…' : agendar ? 'Agendar aviso' : 'Enviar aviso'}
          </Button>
          {resultado && <p role="status" className="text-sm text-muted-foreground">{resultado}</p>}
        </form>
      </section>
      <HistoricoEnvios envios={envios} onCancelar={async (id) => {
        if (!window.confirm('Cancelar este aviso agendado? Ele não será entregue aos alunos.')) return;
        try { await cancelar({ data: { envioId: id } }); toast.success('Aviso agendado cancelado.'); void carregarEnvios(); }
        catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível cancelar.'); void carregarEnvios(); }
      }} />
    </div>
  );
}

function HistoricoEnvios({ envios, onCancelar }: { envios: Envio[] | null; onCancelar: (id: string) => void }) {
  const [aberto, setAberto] = useState<string | null>(null);
  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-semibold">Avisos enviados</h2>
      {envios === null ? <p className="text-sm text-muted-foreground">Carregando…</p>
        : !envios.length ? <p className="text-sm text-muted-foreground">Nenhum aviso enviado ainda.</p>
        : <div className="space-y-3">{envios.map((e) => {
          const agendado = !!e.agendado_para && new Date(e.agendado_para) > new Date();
          const pct = e.total ? Math.round((e.lidos / e.total) * 100) : 0;
          const para = e.destino === 'todos' ? 'Todos os alunos' : e.destino === 'turma' ? `Turma ${e.turma ?? '(removida)'}` : e.total === 1 ? 'Um aluno' : `${e.total} alunos`;
          return (
            <article key={e.envio_id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="break-words font-semibold">{e.titulo}</h3>
                  <p className="text-xs text-muted-foreground">{para} · {agendado ? `agendado para ${dataHora(e.agendado_para!)}` : dataHora(e.agendado_para ?? e.criado_em)}{e.autor ? ` · por ${e.autor}` : ''}</p>
                </div>
                {agendado ? <Badge variant="secondary" className="gap-1"><Clock className="size-3" />Agendado</Badge> : <Badge variant="outline" className="gap-1"><CheckCheck className="size-3" />{e.lidos} de {e.total} leram</Badge>}
              </div>
              <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{e.mensagem}</p>
              {!agendado && <Progress value={pct} className="mt-3 h-2" aria-label={`${pct}% leram`} />}
              <div className="mt-3 flex flex-wrap gap-2">
                {agendado
                  ? <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onCancelar(e.envio_id)}><X className="mr-1 size-4" />Cancelar agendamento</Button>
                  : <Button size="sm" variant="ghost" onClick={() => setAberto(aberto === e.envio_id ? null : e.envio_id)} aria-expanded={aberto === e.envio_id}>
                      {aberto === e.envio_id ? <ChevronUp className="mr-1 size-4" /> : <ChevronDown className="mr-1 size-4" />}Ver quem leu
                    </Button>}
              </div>
              {aberto === e.envio_id && <QuemLeu envioId={e.envio_id} />}
            </article>
          );
        })}</div>}
    </section>
  );
}

function QuemLeu({ envioId }: { envioId: string }) {
  const [lista, setLista] = useState<Leitor[] | null>(null);
  const [filtro, setFiltro] = useState<'lidos' | 'nao'>('lidos');
  useEffect(() => {
    let ativo = true;
    void (async () => {
      const todos: Leitor[] = [];
      for (let i = 0; ; i += 1000) {
        const { data, error } = await supabase.from('avisos_alunos').select('id,lido_em,alunos(nome,codigo)').eq('envio_id', envioId).range(i, i + 999);
        if (error) { toast.error('Não foi possível carregar quem leu.'); break; }
        todos.push(...((data ?? []) as Leitor[]));
        if ((data ?? []).length < 1000) break;
      }
      if (ativo) setLista(todos.sort((a, b) => (a.alunos?.nome ?? '').localeCompare(b.alunos?.nome ?? '')));
    })();
    return () => { ativo = false; };
  }, [envioId]);
  if (!lista) return <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>;
  const lidos = lista.filter((l) => l.lido_em), naoLidos = lista.filter((l) => !l.lido_em);
  const mostrados = filtro === 'lidos' ? lidos : naoLidos;
  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <div className="flex gap-2">
        <Button size="sm" variant={filtro === 'lidos' ? 'default' : 'outline'} onClick={() => setFiltro('lidos')}>Leram ({lidos.length})</Button>
        <Button size="sm" variant={filtro === 'nao' ? 'default' : 'outline'} onClick={() => setFiltro('nao')}>Ainda não leram ({naoLidos.length})</Button>
      </div>
      <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
        {mostrados.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span className="min-w-0 truncate">{l.alunos?.nome ?? 'Aluno removido'} <span className="font-mono text-xs text-muted-foreground">{l.alunos?.codigo}</span></span>
            <span className={cn('shrink-0 text-xs', l.lido_em ? 'text-success-strong' : 'text-muted-foreground')}>{l.lido_em ? `Leu em ${dataHora(l.lido_em)}` : 'Não leu'}</span>
          </li>
        ))}
        {!mostrados.length && <li className="px-3 py-4 text-center text-sm text-muted-foreground">Ninguém nesta lista.</li>}
      </ul>
    </div>
  );
}
