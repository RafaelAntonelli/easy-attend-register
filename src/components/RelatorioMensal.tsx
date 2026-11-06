import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { limitesMes, resumirMes, type RegistroMensal } from "@/lib/relatorio-mensal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EstadoVazio } from "@/components/EstadoVazio";

type Turma = { id: string; nome: string; horario: string | null };
export function RelatorioMensal({ turmas }: { turmas: Turma[] }) {
  const [mes, setMes] = useState(() => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(new Date()));
  const [turma, setTurma] = useState("todas");
  const [registros, setRegistros] = useState<RegistroMensal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizacao, setAtualizacao] = useState(0);
  const [exportando, setExportando] = useState(false);
  useEffect(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true); setErro(null); setRegistros([]);
      try {
        const { inicio, fim } = limitesMes(mes);
        const lista: RegistroMensal[] = [];
        for (let offset = 0; ; offset += 500) {
          let query = supabase.from("presencas").select("aluno_id,turma_id,data,status").gte("data", inicio).lt("data", fim).order("id").range(offset, offset + 499);
          if (turma !== "todas") query = query.eq("turma_id", turma);
          const { data, error } = await query;
          if (error) throw error;
          if (!ativo) return;
          lista.push(...(data ?? []));
          if (!data || data.length < 500) break;
        }
        if (ativo) setRegistros(lista);
      } catch (e) { if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível consultar o mês."); }
      finally { if (ativo) setCarregando(false); }
    }
    void carregar();
    return () => { ativo = false; };
  }, [mes, turma, atualizacao]);
  const total = useMemo(() => /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? resumirMes(registros, mes, turma) : null, [registros, mes, turma]);
  const linhas = useMemo(() => total ? turmas.filter((t) => turma === "todas" || t.id === turma).map((t) => ({ ...t, ...resumirMes(registros, mes, t.id) })).filter((t) => t.total > 0) : [], [turmas, turma, registros, mes, total]);
  const semTurma = total ? total.total - linhas.reduce((s, t) => s + t.total, 0) : 0;
  async function baixar() {
    if (!total || !total.total || carregando || erro) return;
    setExportando(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF();
      let y = 20;
      const escrever = (texto: string, tamanho = 10) => {
        pdf.setFontSize(tamanho);
        const partes: string[] = pdf.splitTextToSize(texto, 180);
        for (const parte of partes) { if (y > 275) { pdf.addPage(); y = 20; } pdf.text(parte, 15, y); y += tamanho === 16 ? 9 : 6; }
      };
      escrever("Arena Aquática — Relatório mensal", 16);
      escrever(`Mês: ${mes.split("-").reverse().join("/")} | Turma: ${turma === "todas" ? "Todas" : turmas.find((t) => t.id === turma)?.nome ?? turma}`);
      escrever(`Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (horário de Brasília)`);
      y += 5;
      escrever(`Alunos com registro: ${total.alunos} | Marcações: ${total.total}`);
      escrever(`Presenças: ${total.presentes} | Faltas: ${total.faltas} | Justificadas: ${total.justificadas}`);
      escrever(`Frequência: ${total.frequencia}% (presenças / todas as marcações)`);
      y += 6;
      escrever("Resumo por turma", 14);
      for (const linha of linhas) { escrever(`${linha.nome} ${linha.horario?.slice(0, 5) ?? ""}`, 12); escrever(`${linha.alunos} alunos | ${linha.presentes} presenças | ${linha.faltas} faltas | ${linha.justificadas} justificadas | ${linha.frequencia}%`); y += 3; }
      if (semTurma) escrever(`Registros sem turma disponível: ${semTurma}`);
      escrever("Cada aluno é contado uma vez no total geral. Cada marcação é contada na turma correspondente. Dias sem registro não são considerados faltas.");
      pdf.save(`relatorio-mensal-${mes}.pdf`);
      toast.success("Relatório mensal baixado.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Não foi possível gerar o PDF."); }
    finally { setExportando(false); }
  }
  return <section className="space-y-5" aria-label="Relatório mensal">
    <div className="flex flex-wrap items-end gap-3"><div className="space-y-2"><Label htmlFor="mes-relatorio">Mês</Label><Input id="mes-relatorio" type="month" value={mes} onChange={(e) => setMes(e.target.value)} /></div><div className="min-w-0 space-y-2 sm:w-72"><Label>Turma</Label><Select value={turma} onValueChange={setTurma}><SelectTrigger aria-label="Turma do relatório mensal"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas as turmas</SelectItem>{turmas.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome} {t.horario?.slice(0, 5)}</SelectItem>)}</SelectContent></Select></div><Button variant="outline" size="icon" title="Atualizar relatório" aria-label="Atualizar relatório" disabled={carregando} onClick={() => setAtualizacao((v) => v + 1)}><RefreshCw className="size-4" /></Button><Button disabled={carregando || Boolean(erro) || !total?.total || exportando} onClick={() => void baixar()}><Download className="size-4" /> {exportando ? "Gerando…" : "Baixar relatório mensal PDF"}</Button></div>
    {carregando ? <p className="text-sm text-muted-foreground" role="status">Consultando marcações do mês…</p> : erro ? <EstadoVazio icone={AlertTriangle} titulo="Não foi possível consultar" descricao={erro}><Button variant="outline" onClick={() => setAtualizacao((v) => v + 1)}>Tentar novamente</Button></EstadoVazio> : total?.total ? <>
      <dl className="grid grid-cols-2 gap-4 border-y border-border py-4 sm:grid-cols-5">{[["Alunos com registro", total.alunos], ["Presenças", total.presentes], ["Faltas", total.faltas], ["Justificadas", total.justificadas], ["Frequência", `${total.frequencia}%`]].map(([nome, valor]) => <div key={nome}><dt className="text-xs text-muted-foreground">{nome}</dt><dd className="text-2xl font-semibold tabular-nums">{valor}</dd></div>)}</dl>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border">{["Turma", "Alunos", "Presenças", "Faltas", "Justificadas", "Frequência"].map((t) => <th className="px-3 py-3 font-semibold" key={t}>{t}</th>)}</tr></thead><tbody>{linhas.map((t) => <tr key={t.id} className="border-b border-border"><td className="px-3 py-3">{t.nome} {t.horario?.slice(0, 5)}</td>{[t.alunos, t.presentes, t.faltas, t.justificadas, `${t.frequencia}%`].map((v, i) => <td key={i} className="px-3 py-3 tabular-nums">{v}</td>)}</tr>)}</tbody></table></div>
      {semTurma > 0 && <p className="text-sm text-muted-foreground">{semTurma} marcações sem turma disponível, incluídas no total geral.</p>}
    </> : <EstadoVazio icone={FileText} titulo="Nenhuma marcação neste mês" descricao="Escolha outro mês ou outra turma." />}
  </section>;
}