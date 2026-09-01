import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CloudUpload, Download, FileSpreadsheet, FileText, IdCard, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { ImportarAlunos } from "@/components/ImportarAlunos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { atestadoVencendo, atestadoVencido, diasParaVencer, vencimentoAtestado } from "@/lib/atestado";
import { usePrazoAvisoAtestado } from "@/lib/configuracoes";
import { montarPlanilhaAlunos, type AlunoPlanilha } from "@/lib/planilha-alunos";
import { gerarCrachasPdfFielAoPreview, type DadosCracha } from "@/lib/cracha";
import { fazerBackup } from "@/lib/backup.functions";

export const Route = createFileRoute("/relatorios")({
  component: RelatoriosPage,
  head: () => ({
    meta: [
      { title: "Relatórios e backup | Arena Aquática" },
      {
        name: "description",
        content: "Acompanhe atestados vencendo, exporte planilhas e crachás e faça o backup no Google Drive.",
      },
      { property: "og:title", content: "Relatórios e backup | Arena Aquática" },
      { property: "og:description", content: "Atestados a vencer, exportações e backup da Arena Aquática." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Aluno = AlunoPlanilha & {
  codigo: string;
  foto_path: string | null;
  telefone: string | null;
  pcd: boolean;
};
type Turma = { id: string; nome: string; horario: string | null; dias_semana: string[]; modalidade: string; capacidade: number };
type Matricula = { id: string; aluno_id: string; turma_id: string; modalidade: string };

const PRAZOS = [15, 30, 45, 60, 90];

function RelatoriosPage() {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [gerandoCrachas, setGerandoCrachas] = useState(false);
  const [backupando, setBackupando] = useState(false);
  const { valor: prazo, salvar: salvarPrazo } = usePrazoAvisoAtestado();
  const [prazoEditado, setPrazoEditado] = useState<string>("");
  const executarBackup = useServerFn(fazerBackup);

  useEffect(() => {
    setPrazoEditado(String(prazo));
  }, [prazo]);

  async function carregar() {
    setCarregando(true);
    try {
      const [a, t, m] = await Promise.all([
        supabase.from("alunos").select("*").order("nome"),
        supabase.from("turmas").select("id,nome,horario,dias_semana,modalidade,capacidade").order("nome"),
        supabase.from("matriculas").select("*"),
      ]);
      if (a.error) throw a.error;
      setAlunos((a.data ?? []) as Aluno[]);
      setTurmas((t.data ?? []) as Turma[]);
      setMatriculas((m.data ?? []) as Matricula[]);

      const comFoto = ((a.data ?? []) as Aluno[]).filter((x) => x.foto_path);
      if (comFoto.length) {
        const { data: signed } = await supabase.storage
          .from("fotos-alunos")
          .createSignedUrls(comFoto.map((x) => x.foto_path as string), 3600);
        const mapa: Record<string, string> = {};
        signed?.forEach((s, i) => {
          const aluno = comFoto[i];
          if (s.signedUrl && aluno) mapa[aluno.id] = s.signedUrl;
        });
        setFotos(mapa);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar dados");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  function matriculaDoAluno(id: string) {
    return matriculas.find((m) => m.aluno_id === id);
  }
  function turmaDoAluno(id: string) {
    const m = matriculaDoAluno(id);
    return m ? turmas.find((t) => t.id === m.turma_id) : undefined;
  }
  function modalidadeDoAluno(id: string) {
    return matriculaDoAluno(id)?.modalidade ?? turmaDoAluno(id)?.modalidade ?? "";
  }

  const vencidos = useMemo(
    () => alunos.filter((a) => a.atestado_entregue && atestadoVencido(a.atestado_data)),
    [alunos],
  );
  const vencendo = useMemo(
    () =>
      alunos
        .filter((a) => a.atestado_entregue && atestadoVencendo(a.atestado_data, prazo))
        .sort((x, y) => diasParaVencer(x.atestado_data) - diasParaVencer(y.atestado_data)),
    [alunos, prazo],
  );

  const relatorio = useMemo(
    () =>
      [...vencidos.map((a) => ({ aluno: a, situacao: "Vencido" as const })), ...vencendo.map((a) => ({ aluno: a, situacao: "A vencer" as const }))],
    [vencidos, vencendo],
  );

  function linhasRelatorio() {
    return relatorio.map(({ aluno, situacao }) => {
      const t = turmaDoAluno(aluno.id);
      const venc = vencimentoAtestado(aluno.atestado_data);
      return [
        aluno.nome,
        aluno.telefone ?? "",
        aluno.responsavel ?? "",
        modalidadeDoAluno(aluno.id),
        t?.nome ?? "",
        t?.horario ?? "",
        aluno.atestado_data ?? "",
        venc ? venc.toLocaleDateString("pt-BR") : "",
        situacao,
        situacao === "Vencido" ? "0" : String(diasParaVencer(aluno.atestado_data)),
      ];
    });
  }

  const CABECALHO_RELATORIO = [
    "Aluno",
    "Celular",
    "Responsável",
    "Modalidade",
    "Turma",
    "Horário",
    "Data do atestado",
    "Vence em",
    "Situação",
    "Dias restantes",
  ];

  function exportarCsv() {
    if (!relatorio.length) return toast.error("Nenhum atestado vencido ou a vencer");
    const escapar = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [CABECALHO_RELATORIO, ...linhasRelatorio()].map((l) => l.map(escapar).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `atestados-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado em CSV");
    return;
  }

  async function exportarPdf() {
    if (!relatorio.length) return toast.error("Nenhum atestado vencido ou a vencer");
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const larguras = [50, 28, 42, 24, 32, 24, 26, 24, 20, 18];
    let y = 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Atestados vencidos e a vencer — Arena Aquática", 12, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Prazo de aviso: ${prazo} dias · Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 12, 16.5);

    const escreverLinha = (celulas: string[], negrito = false) => {
      doc.setFont("helvetica", negrito ? "bold" : "normal");
      doc.setFontSize(8);
      let x = 12;
      celulas.forEach((c, i) => {
        const largura = larguras[i] ?? 24;
        doc.text(doc.splitTextToSize(c, largura - 2)[0] ?? "", x, y);
        x += largura;
      });
      y += 5.5;
    };

    y += 6;
    escreverLinha(CABECALHO_RELATORIO, true);
    doc.setDrawColor(200);
    doc.line(12, y - 4, 285, y - 4);

    for (const linha of linhasRelatorio()) {
      if (y > 195) {
        doc.addPage();
        y = 18;
        escreverLinha(CABECALHO_RELATORIO, true);
      }
      escreverLinha(linha);
    }

    doc.save(`atestados-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("Relatório exportado em PDF");
    return;
  }

  async function exportarPlanilha() {
    setExportando(true);
    try {
      const buffer = await montarPlanilhaAlunos({
        alunos,
        turmaDoAluno,
        modalidadeDoAluno,
        baixarArquivo: async (caminho) => {
          const { data } = await supabase.storage.from("fotos-alunos").download(caminho);
          return data ? await data.arrayBuffer() : null;
        },
      });
      const url = URL.createObjectURL(
        new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `alunos-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Planilha exportada em ordem crescente de idade");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao exportar planilha");
    } finally {
      setExportando(false);
    }
  }

  function dadosCracha(a: Aluno): DadosCracha {
    const t = turmaDoAluno(a.id);
    return {
      nome: a.nome,
      rg: a.rg ?? null,
      cpf: a.cpf ?? null,
      responsavel: a.responsavel ?? null,
      telefone: a.telefone,
      pcd: Boolean(a.pcd),
      modalidade: modalidadeDoAluno(a.id),
      horario: t?.horario ?? "",
      dias: t?.dias_semana ?? [],
      fotoUrl: fotos[a.id] ?? null,
      codigo: a.codigo,
    };
  }

  async function exportarCrachas(lista: Aluno[], formato: "cartao" | "folha") {
    if (!lista.length) return toast.error("Nenhum aluno para gerar crachá");
    setGerandoCrachas(true);
    const idToast = toast.loading(`Gerando crachás… 0/${lista.length}`);
    try {
      const nome = lista.length === 1 ? `cracha-${lista[0]!.nome.replace(/\s+/g, "-").toLowerCase()}` : "crachas-arena-aquatica";
      await gerarCrachasPdfFielAoPreview(lista.map(dadosCracha), formato === "folha" ? `${nome}-a4` : nome, {
        formato,
        aoProgredir: (feitos, total) => toast.loading(`Gerando crachás… ${feitos}/${total}`, { id: idToast }),
      });
      toast.success(`${lista.length} crachá(s) gerado(s)`, { id: idToast });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar crachás", { id: idToast });
    } finally {
      setGerandoCrachas(false);
    }
    return;
  }

  async function backupAgora() {
    setBackupando(true);
    const idToast = toast.loading("Enviando backup para o Google Drive…");
    try {
      const r = await executarBackup({ data: undefined });
      toast.success(
        `Backup concluído: ${r.planilha} e ${r.imagens} imagem(ns)${r.falhas.length ? ` · ${r.falhas.length} falha(s)` : ""}`,
        { id: idToast },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no backup", { id: idToast });
    } finally {
      setBackupando(false);
    }
  }

  async function aplicarPrazo(valor: string) {
    const numero = Number(valor);
    if (!Number.isFinite(numero) || numero < 1) return toast.error("Informe um prazo válido em dias");
    try {
      await salvarPrazo(Math.round(numero));
      toast.success(`Aviso configurado para ${Math.round(numero)} dias antes do vencimento`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a configuração");
    }
    return;
  }

  return (
    <AppShell title="Relatórios" subtitle="Atestados, exportações e backup da Arena Aquática">
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <Settings2 className="size-4" /> Prazo do aviso de atestado
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <Label>Avisar com antecedência de</Label>
            <div className="flex items-center gap-2">
              <Select value={PRAZOS.includes(Number(prazoEditado)) ? prazoEditado : "custom"} onValueChange={(v) => v !== "custom" && setPrazoEditado(v)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Prazo" />
                </SelectTrigger>
                <SelectContent>
                  {PRAZOS.map((p) => (
                    <SelectItem key={p} value={String(p)}>{p} dias</SelectItem>
                  ))}
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
              <Input
                className="w-24"
                type="number"
                min={1}
                value={prazoEditado}
                onChange={(e) => setPrazoEditado(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">dias</span>
            </div>
          </div>
          <Button onClick={() => void aplicarPrazo(prazoEditado)}>Salvar prazo</Button>
        </CardContent>
      </Card>

      <div className="mb-6 flex flex-wrap gap-3">
        <Button variant="outline" disabled={exportando} onClick={() => void exportarPlanilha()}>
          <FileSpreadsheet className="size-4" /> {exportando ? "Exportando..." : "Exportar planilha"}
        </Button>
        <ImportarAlunos turmas={turmas} matriculas={matriculas} alunos={alunos} onImportado={() => void carregar()} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={gerandoCrachas || !alunos.length}>
              <IdCard className="size-4" /> {gerandoCrachas ? "Gerando..." : "Crachás"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>Exportar crachás CR-80 (PDF)</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => void exportarCrachas(alunos, "cartao")}>
              Todos os alunos ({alunos.length}) — 1 por página
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void exportarCrachas(alunos, "folha")}>
              Todos os alunos ({alunos.length}) — folha A4
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button disabled={backupando} onClick={() => void backupAgora()}>
          <CloudUpload className="size-4" /> {backupando ? "Enviando..." : "Fazer Backup"}
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <AlertTriangle className="size-4 text-destructive" /> Atestados vencidos e a vencer
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportarCsv}>
              <Download className="size-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => void exportarPdf()}>
              <FileText className="size-4" /> PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {carregando ? (
            <p className="py-6 text-sm text-muted-foreground">Carregando...</p>
          ) : !relatorio.length ? (
            <p className="py-6 text-sm text-muted-foreground">
              Nenhum atestado vencido ou vencendo nos próximos {prazo} dias.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    {CABECALHO_RELATORIO.map((c) => (
                      <th key={c} className="py-2 pr-4 font-medium">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {relatorio.map(({ aluno, situacao }) => {
                    const t = turmaDoAluno(aluno.id);
                    const venc = vencimentoAtestado(aluno.atestado_data);
                    return (
                      <tr key={aluno.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">{aluno.nome}</td>
                        <td className="py-2 pr-4">{aluno.telefone ?? "—"}</td>
                        <td className="py-2 pr-4">{aluno.responsavel ?? "—"}</td>
                        <td className="py-2 pr-4">{modalidadeDoAluno(aluno.id) || "—"}</td>
                        <td className="py-2 pr-4">{t?.nome ?? "—"}</td>
                        <td className="py-2 pr-4">{t?.horario ?? "—"}</td>
                        <td className="py-2 pr-4">{aluno.atestado_data ?? "—"}</td>
                        <td className="py-2 pr-4">{venc ? venc.toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={situacao === "Vencido" ? "destructive" : "secondary"}>{situacao}</Badge>
                        </td>
                        <td className="py-2 pr-4">{situacao === "Vencido" ? 0 : diasParaVencer(aluno.atestado_data)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
