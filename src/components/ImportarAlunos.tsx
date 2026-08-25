import { useState } from "react";
import * as XLSX from "xlsx";
import { FileSpreadsheet, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { capitalizarNome, formatarCelular, formatarCPF, apenasDigitos } from "@/lib/formatacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Turma = { id: string; nome: string; horario: string | null; modalidade: string | null; capacidade: number | null };
type Matricula = { aluno_id: string; turma_id: string; status: string };

const COLUNAS = [
  "Nome",
  "Sexo",
  "Idade",
  "Nascimento",
  "CPF",
  "RG",
  "Celular",
  "Celular 2",
  "E-mail",
  "Responsável",
  "Rede de ensino",
  "Escola",
  "PCD",
  "Modalidade",
  "Turma",
  "Observações",
] as const;

type Linha = Record<string, unknown>;

function texto(v: unknown) {
  return v == null ? "" : String(v).trim();
}

function dataISO(v: unknown) {
  const s = texto(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  return null;
}

function sim(v: unknown) {
  return /^(sim|s|true|1|x)$/i.test(texto(v));
}

export function ImportarAlunos({
  turmas,
  matriculas,
  onImportado,
}: {
  turmas: Turma[];
  matriculas: Matricula[];
  onImportado: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [arquivo, setArquivo] = useState<string>("");
  const [importando, setImportando] = useState(false);

  function baixarModelo() {
    const ws = XLSX.utils.aoa_to_sheet([
      [...COLUNAS],
      [
        "Maria da Silva", "Feminino", 12, "2014-03-25", "000.000.000-00", "12.345.678-9",
        "(11) 99999-9999", "", "maria@email.com", "João da Silva", "Pública", "Escola Municipal",
        "Não", "Natação", turmas[0]?.nome ?? "", "",
      ],
    ]);
    ws["!cols"] = COLUNAS.map((c) => ({ wch: Math.max(c.length + 4, 14) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");
    XLSX.writeFile(wb, "modelo-importacao-alunos.xlsx");
  }

  async function selecionar(file: File | null) {
    if (!file) return;
    setArquivo(file.name);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const nomePlan = wb.SheetNames[0];
    if (!nomePlan) return toast.error("Planilha vazia.");
    const ws = wb.Sheets[nomePlan];
    if (!ws) return toast.error("Planilha vazia.");
    const dados = XLSX.utils.sheet_to_json<Linha>(ws, { defval: "" });
    const validas = dados.filter((l) => texto(l["Nome"]));
    if (!validas.length) return toast.error("Nenhuma linha com a coluna 'Nome' preenchida.");
    setLinhas(validas);
    return;
  }

  async function importar() {
    setImportando(true);
    let criados = 0;
    let matriculados = 0;
    const erros: string[] = [];
    const ocupacao = new Map<string, number>();
    for (const m of matriculas) {
      if (m.status === "ativa") ocupacao.set(m.turma_id, (ocupacao.get(m.turma_id) ?? 0) + 1);
    }

    for (const l of linhas) {
      const nome = capitalizarNome(texto(l["Nome"]));
      const cpf = texto(l["CPF"]) ? formatarCPF(texto(l["CPF"])) : null;
      const payload = {
        nome,
        sexo: texto(l["Sexo"]) || null,
        idade: texto(l["Idade"]) ? Number(apenasDigitos(texto(l["Idade"]))) || null : null,
        data_nascimento: dataISO(l["Nascimento"]),
        cpf,
        rg: texto(l["RG"]) || null,
        telefone: texto(l["Celular"]) ? formatarCelular(texto(l["Celular"])) : null,
        telefone2: texto(l["Celular 2"]) ? formatarCelular(texto(l["Celular 2"])) : null,
        email: texto(l["E-mail"]) || null,
        responsavel: texto(l["Responsável"]) || null,
        rede_ensino: texto(l["Rede de ensino"]) || null,
        escola: texto(l["Escola"]) || null,
        pcd: sim(l["PCD"]),
        observacoes: texto(l["Observações"]) || null,
      };

      const { data, error } = await supabase.from("alunos").insert(payload).select("id").single();
      if (error || !data) {
        erros.push(`${nome}: ${error?.message ?? "falha ao cadastrar"}`);
        continue;
      }
      criados++;

      const nomeTurma = texto(l["Turma"]);
      if (!nomeTurma) continue;
      const alvo = turmas.find(
        (t) => t.nome.toLowerCase() === nomeTurma.toLowerCase() || `${t.nome} ${t.horario ?? ""}`.trim().toLowerCase() === nomeTurma.toLowerCase(),
      );
      if (!alvo) {
        erros.push(`${nome}: turma "${nomeTurma}" não encontrada`);
        continue;
      }
      const usadas = ocupacao.get(alvo.id) ?? 0;
      if (usadas >= (alvo.capacidade ?? 40)) {
        erros.push(`${nome}: turma "${alvo.nome}" lotada`);
        continue;
      }
      const { error: erroMat } = await supabase.from("matriculas").insert({
        aluno_id: data.id,
        turma_id: alvo.id,
        status: "ativa",
        modalidade: texto(l["Modalidade"]) || alvo.modalidade || "Natação",
        data_inicio: new Date().toISOString().slice(0, 10),
      });
      if (erroMat) {
        erros.push(`${nome}: ${erroMat.message}`);
        continue;
      }
      ocupacao.set(alvo.id, usadas + 1);
      matriculados++;
    }

    setImportando(false);
    setLinhas([]);
    setArquivo("");
    setAberto(false);
    onImportado();
    if (criados) toast.success(`${criados} aluno(s) importado(s) · ${matriculados} matriculado(s) em turma`);
    if (erros.length) toast.error(`${erros.length} aviso(s): ${erros.slice(0, 3).join(" · ")}`);
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="size-4" /> Importar planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">Importar alunos por planilha</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use um arquivo Excel (.xlsx) ou CSV com a primeira linha de cabeçalho. Apenas a coluna <strong>Nome</strong> é
            obrigatória; a coluna <strong>Turma</strong> matricula o aluno automaticamente na turma correspondente.
          </p>
          <Button variant="outline" onClick={baixarModelo}>
            <Download className="size-4" /> Baixar modelo
          </Button>
          <div className="space-y-2">
            <Label>Arquivo</Label>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => void selecionar(e.target.files?.[0] ?? null)}
            />
            {arquivo ? <p className="text-xs text-muted-foreground">{arquivo}</p> : null}
          </div>

          {linhas.length ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Pré-visualização · {linhas.length} aluno(s)</p>
              <div className="max-h-64 overflow-auto rounded-lg border border-border/70">
                <table className="w-full text-left text-xs">
                  <thead className="bg-secondary/60">
                    <tr>
                      <th className="p-2">Nome</th>
                      <th className="p-2">CPF</th>
                      <th className="p-2">Celular</th>
                      <th className="p-2">Turma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.slice(0, 50).map((l, i) => (
                      <tr key={i} className="border-t border-border/60">
                        <td className="p-2">{capitalizarNome(texto(l["Nome"]))}</td>
                        <td className="p-2">{texto(l["CPF"])}</td>
                        <td className="p-2">{texto(l["Celular"])}</td>
                        <td className="p-2">{texto(l["Turma"])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button disabled={importando} onClick={() => void importar()}>
                <Upload className="size-4" /> {importando ? "Importando..." : `Importar ${linhas.length} aluno(s)`}
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
