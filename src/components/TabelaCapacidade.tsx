import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { turnoDoHorario, TURNOS } from "@/lib/turnos";
import { hojeISO, licencaEmVigor, type Licenca } from "@/lib/licenca";

type Linha = {
  id: string; nome: string; modalidade: string; turno: string;
  capacidade: number; matriculados: number; licenca: number; livres: number;
};

const CABECALHO = ["Turma", "Modalidade", "Turno", "Capacidade", "Matriculados", "Em Licença Médica", "Vagas Livres", "Ocupação"];
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

export function TabelaCapacidade() {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [modalidade, setModalidade] = useState("Todas");
  const [turno, setTurno] = useState("Todos");

  useEffect(() => {
    void (async () => {
      const [t, m, l] = await Promise.all([
        supabase.from("turmas").select("id,nome,modalidade,horario,capacidade").eq("ativa", true).order("nome"),
        supabase.from("matriculas").select("aluno_id,turma_id,alunos!inner(ativo)").eq("status", "ativa").eq("alunos.ativo", true),
        supabase.from("licencas_medicas").select("id,aluno_id,data_inicio,data_retorno,motivo,encerrada_em").is("encerrada_em", null),
      ]);
      if (t.error || m.error || l.error) toast.error("Erro ao carregar capacidade das turmas");
      const hoje = hojeISO();
      const emLicenca = new Set(((l.data ?? []) as Licenca[]).filter((x) => licencaEmVigor(x, hoje)).map((x) => x.aluno_id));
      const mats = (m.data ?? []) as { aluno_id: string; turma_id: string }[];
      setLinhas((t.data ?? []).map((tu) => {
        const daTurma = mats.filter((x) => x.turma_id === tu.id);
        const cap = tu.capacidade ?? 40;
        return {
          id: tu.id, nome: tu.nome, modalidade: tu.modalidade, turno: turnoDoHorario(tu.horario) || "—",
          capacidade: cap, matriculados: daTurma.length,
          licenca: daTurma.filter((x) => emLicenca.has(x.aluno_id)).length,
          livres: Math.max(0, cap - daTurma.length),
        };
      }));
      setCarregando(false);
    })();
  }, []);

  const visiveis = useMemo(() => linhas.filter((l) =>
    (modalidade === "Todas" || l.modalidade === modalidade) && (turno === "Todos" || l.turno === turno)), [linhas, modalidade, turno]);
  const tot = useMemo(() => visiveis.reduce((a, l) => ({
    capacidade: a.capacidade + l.capacidade, matriculados: a.matriculados + l.matriculados,
    licenca: a.licenca + l.licenca, livres: a.livres + l.livres,
  }), { capacidade: 0, matriculados: 0, licenca: 0, livres: 0 }), [visiveis]);
  const modalidades = useMemo(() => ["Todas", ...new Set(linhas.map((l) => l.modalidade))], [linhas]);

  const dados = () => [
    ...visiveis.map((l) => [l.nome, l.modalidade, l.turno, String(l.capacidade), String(l.matriculados), String(l.licenca), String(l.livres), `${pct(l.matriculados, l.capacidade)}%`]),
    ["TOTAL GERAL", "", "", String(tot.capacidade), String(tot.matriculados), String(tot.licenca), String(tot.livres), `${pct(tot.matriculados, tot.capacidade)}%`],
  ];
  const data = new Date().toISOString().slice(0, 10);

  function exportarCsv() {
    const csv = [CABECALHO, ...dados()].map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `capacidade-turmas-${data}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function exportarPdf() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const larg = [90, 32, 26, 22, 26, 30, 24, 22];
    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text("Capacidade e vagas ociosas por turma — Arena Aquática", 12, 12);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} · Modalidade: ${modalidade} · Turno: ${turno}`, 12, 17);
    let y = 26;
    const linha = (c: string[], negrito = false, fundo = false) => {
      if (fundo) { doc.setFillColor(240, 244, 248); doc.rect(11, y - 4, 274, 6, "F"); }
      doc.setFont("helvetica", negrito ? "bold" : "normal"); doc.setFontSize(8.5);
      let x = 12;
      c.forEach((v, i) => {
        const w = larg[i] ?? 24;
        const txt = doc.splitTextToSize(v, w - 2)[0] ?? "";
        if (i >= 3) doc.text(txt, x + w - 3, y, { align: "right" }); else doc.text(txt, x, y);
        x += w;
      });
      y += 6;
    };
    linha(CABECALHO, true, true);
    const corpo = dados(); const total = corpo.pop()!;
    corpo.forEach((c, i) => {
      if (y > 190) { doc.addPage(); y = 16; linha(CABECALHO, true, true); }
      linha(c, false, i % 2 === 1);
    });
    if (y > 170) { doc.addPage(); y = 16; }
    doc.setDrawColor(150); doc.line(12, y - 4, 285, y - 4);
    linha(total, true);
    y += 6;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("Totais gerais", 12, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    [`Capacidade total: ${tot.capacidade} vagas`, `Total ocupado: ${tot.matriculados} alunos`, `Em licença médica: ${tot.licenca}`,
      `Vagas disponíveis: ${tot.livres}`, `Taxa de ocupação global: ${pct(tot.matriculados, tot.capacidade)}%`]
      .forEach((t) => { doc.text(t, 12, y); y += 5.5; });
    doc.save(`capacidade-turmas-${data}.pdf`);
  }

  const cor = (p: number) => (p >= 100 ? "bg-destructive" : p >= 80 ? "bg-accent" : "bg-primary");
  const filtro = (opcoes: readonly string[], valor: string, set: (v: string) => void, rotulo: string) => (
    <div className="flex flex-wrap gap-1" role="group" aria-label={rotulo}>
      {opcoes.map((o) => <Button key={o} size="sm" variant={valor === o ? "default" : "outline"} onClick={() => set(o)}>{o}</Button>)}
    </div>
  );

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-base"><Users className="size-4" /> Capacidade e vagas ociosas por turma</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportarCsv} disabled={carregando}><Download className="size-4" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={() => void exportarPdf()} disabled={carregando}><FileText className="size-4" /> PDF</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {filtro(modalidades, modalidade, setModalidade, "Modalidade")}
          {filtro(["Todos", ...TURNOS], turno, setTurno, "Turno")}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[["Capacidade total", `${tot.capacidade} vagas`], ["Total ocupado", `${tot.matriculados} alunos`], ["Vagas disponíveis", String(tot.livres)], ["Ocupação global", `${pct(tot.matriculados, tot.capacidade)}%`]].map(([r, v]) => (
            <div key={r} className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{r}</p><p className="text-xl font-semibold tabular-nums">{carregando ? "—" : v}</p></div>
          ))}
        </div>
        {carregando ? <p className="py-6 text-sm text-muted-foreground">Carregando...</p> : (
          <div className="max-h-[32rem] overflow-auto rounded-lg border border-border">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  {CABECALHO.map((c, i) => <th key={c} className={`px-3 py-2 font-medium ${i >= 3 ? "text-right" : ""}`}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {visiveis.map((l) => {
                  const p = pct(l.matriculados, l.capacidade);
                  return (
                    <tr key={l.id} className="border-t border-border">
                      <td className="px-3 py-2 font-medium">{l.nome}</td>
                      <td className="px-3 py-2">{l.modalidade}</td>
                      <td className="px-3 py-2">{l.turno}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.capacidade}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.matriculados}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.licenca}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{l.livres}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-muted"><div className={`h-full ${cor(p)}`} style={{ width: `${Math.min(100, p)}%` }} /></div>
                          <span className="w-12 text-right tabular-nums">{p}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!visiveis.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Nenhuma turma encontrada.</td></tr>}
              </tbody>
              <tfoot className="sticky bottom-0 bg-muted font-semibold">
                <tr className="border-t border-border">
                  <td className="px-3 py-2" colSpan={3}>Total geral ({visiveis.length} turmas)</td>
                  <td className="px-3 py-2 text-right tabular-nums">{tot.capacidade}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{tot.matriculados}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{tot.licenca}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{tot.livres}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(tot.matriculados, tot.capacidade)}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
