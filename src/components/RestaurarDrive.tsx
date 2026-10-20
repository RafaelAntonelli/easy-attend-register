import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { DatabaseBackup, FileSearch, Link2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { analisarRestauracaoFn, restaurarAlunosFn, restaurarArquivosFn } from "@/lib/restauracao.functions";
import { TIPOS_ARQUIVO_BACKUP } from "@/lib/backup-nomes";
import { useConfiguracaoNumero } from "@/lib/configuracoes";
import {
  CHAVE_VALIDADE_LINKS,
  OPCOES_VALIDADE_LINKS,
  VALIDADE_LINKS_PADRAO,
  validadeLinksHoras,
} from "@/lib/configuracoes-chaves";

type Analise = Awaited<ReturnType<typeof analisarRestauracaoFn>>;

const ROTULO_CAMPO = Object.fromEntries(TIPOS_ARQUIVO_BACKUP.map((t) => [t.campo, t.rotulo])) as Record<string, string>;

/** Restaura alunos apagados e seus arquivos a partir da planilha e das pastas do backup no Drive. */
export function RestaurarDrive() {
  const analisar = useServerFn(analisarRestauracaoFn);
  const restaurarAlunos = useServerFn(restaurarAlunosFn);
  const restaurarArquivos = useServerFn(restaurarArquivosFn);
  const [planilha, setPlanilha] = useState("");
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [recriar, setRecriar] = useState(true);
  const [substituir, setSubstituir] = useState(false);
  const [executando, setExecutando] = useState(false);
  const [progresso, setProgresso] = useState<{ etapa: string; feitos: number; total: number } | null>(null);
  const [resultado, setResultado] = useState<{ resumo: string; erros: string[] } | null>(null);

  async function fazerAnalise() {
    setAnalisando(true);
    setAnalise(null);
    setResultado(null);
    try {
      setAnalise(await analisar({ data: { planilha: planilha.trim() || undefined } }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível ler o backup no Drive.");
    } finally {
      setAnalisando(false);
    }
  }

  const arquivosRestaurar = analise
    ? analise.arquivos.filter(
        (a) => a.situacao === "repor" || (a.situacao === "novo_aluno" && recriar) || (a.situacao === "existente" && substituir),
      )
    : [];

  async function restaurar() {
    if (!analise) return;
    const alunos = recriar ? analise.aRecriar : [];
    if (!alunos.length && !arquivosRestaurar.length) {
      toast.info("Não há nada para restaurar com as opções escolhidas.");
      return;
    }
    if (
      !confirm(
        `Restaurar ${alunos.length} aluno(s) e ${arquivosRestaurar.length} arquivo(s) do backup "${analise.planilha.nome}"?`,
      )
    )
      return;
    setExecutando(true);
    setResultado(null);
    const erros: string[] = [];
    let criados = 0;
    let restaurados = 0;
    let pulados = 0;
    try {
      for (let i = 0; i < alunos.length; i += 50) {
        setProgresso({ etapa: "Recriando alunos…", feitos: i, total: alunos.length });
        const r = await restaurarAlunos({
          data: { planilhaId: analise.planilha.id, codigos: alunos.slice(i, i + 50).map((a) => a.codigo) },
        });
        criados += r.criados;
        erros.push(...r.erros);
      }
      for (let i = 0; i < arquivosRestaurar.length; i += 5) {
        setProgresso({ etapa: "Restaurando fotos e documentos…", feitos: i, total: arquivosRestaurar.length });
        const lote = arquivosRestaurar.slice(i, i + 5).map(({ driveId, nome, codigo, campo }) => ({ driveId, nome, codigo, campo }));
        try {
          const r = await restaurarArquivos({ data: { arquivos: lote, substituir } });
          restaurados += r.restaurados;
          pulados += r.pulados;
          erros.push(...r.erros);
        } catch (err) {
          erros.push(...lote.map((a) => `${a.nome}: ${err instanceof Error ? err.message : "falha"}`));
        }
      }
      const resumo = `${criados} aluno(s) recriado(s), ${restaurados} arquivo(s) restaurado(s)${pulados ? `, ${pulados} já existiam` : ""}${erros.length ? `, ${erros.length} problema(s)` : ""}.`;
      setResultado({ resumo, erros });
      if (erros.length) toast.warning(`Restauração concluída com avisos: ${resumo}`);
      else toast.success(`Restauração concluída: ${resumo}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "A restauração foi interrompida.");
      setResultado({ resumo: "A restauração foi interrompida.", erros });
    } finally {
      setExecutando(false);
      setProgresso(null);
      void fazerAnaliseSilenciosa();
    }
  }

  async function fazerAnaliseSilenciosa() {
    try {
      setAnalise(await analisar({ data: { planilha: analise?.planilha.id } }));
    } catch {
      /* mantém a prévia anterior */
    }
  }

  const contagem = analise
    ? {
        repor: analise.arquivos.filter((a) => a.situacao === "repor").length,
        existente: analise.arquivos.filter((a) => a.situacao === "existente").length,
        novo: analise.arquivos.filter((a) => a.situacao === "novo_aluno").length,
      }
    : null;

  return (
    <Card className="max-w-3xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <DatabaseBackup className="size-4" /> Restaurar a partir do Google Drive
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Lê a planilha do backup e as pastas de fotos e documentos. Cada arquivo é ligado ao aluno pelo código de
          matrícula no nome (ex.: <code>A7B92K1_foto.jpg</code>), mesmo que existam alunos com o mesmo nome. Alunos que
          ainda estão no sistema mantêm os dados atuais.
        </p>
        <div className="space-y-2">
          <Label htmlFor="restaurar-planilha">Planilha do backup (link ou ID)</Label>
          <Input
            id="restaurar-planilha"
            value={planilha}
            disabled={analisando || executando}
            onChange={(e) => setPlanilha(e.target.value)}
            placeholder="Em branco: usa a planilha mais recente da pasta de planilhas"
          />
        </div>
        <Button variant="outline" disabled={analisando || executando} onClick={() => void fazerAnalise()}>
          <FileSearch className="mr-2 size-4" />
          {analisando ? "Analisando o backup…" : "Analisar backup"}
        </Button>

        {analise && contagem ? (
          <div className="space-y-4 rounded-lg border border-border p-4">
            <p className="text-sm">
              Planilha: <strong>{analise.planilha.nome}</strong>
            </p>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p>Alunos na planilha: <strong>{analise.totalLinhas}</strong></p>
              <p>Já cadastrados: <strong>{analise.jaCadastrados}</strong></p>
              <p>A recriar (não estão no sistema): <strong>{analise.aRecriar.length}</strong></p>
              <p>Linhas sem código válido: <strong>{analise.semCodigo}</strong></p>
              <p>Arquivos que faltam no sistema: <strong>{contagem.repor}</strong></p>
              <p>Arquivos que o sistema já tem: <strong>{contagem.existente}</strong></p>
              <p>Arquivos de alunos a recriar: <strong>{contagem.novo}</strong></p>
              <p>Arquivos não ligados a nenhum aluno: <strong>{analise.naoVinculados.length}</strong></p>
            </div>
            {analise.repetidos.length ? (
              <p className="text-sm text-destructive">
                Códigos repetidos na planilha (usada a primeira linha): {analise.repetidos.join(", ")}
              </p>
            ) : null}
            {analise.aRecriar.length ? (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium">Ver alunos a recriar</summary>
                <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
                  {analise.aRecriar.map((a) => (
                    <li key={a.codigo}>
                      <span className="font-mono">{a.codigo}</span> – {a.nome}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            {analise.naoVinculados.length ? (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium">Ver arquivos não ligados</summary>
                <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
                  {analise.naoVinculados.map((a, i) => (
                    <li key={`${a.nome}-${i}`} className="break-words">
                      {a.nome} <span className="text-muted-foreground">— {a.motivo}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Arquivos com o nome antigo passam para o padrão novo quando você roda um backup.
                </p>
              </details>
            ) : null}
            {arquivosRestaurar.length ? (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium">Ver arquivos que serão restaurados</summary>
                <ul className="mt-2 max-h-48 space-y-1 overflow-auto">
                  {arquivosRestaurar.map((a) => (
                    <li key={a.driveId}>
                      {a.nome} <span className="text-muted-foreground">— {ROTULO_CAMPO[a.campo]}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}

            <div className="space-y-3 border-t border-border pt-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="restaurar-recriar" className="text-sm font-normal">
                  Recriar os alunos que não existem no sistema (com o mesmo código de matrícula)
                </Label>
                <Switch id="restaurar-recriar" checked={recriar} disabled={executando} onCheckedChange={setRecriar} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="restaurar-substituir" className="text-sm font-normal">
                  Substituir fotos e documentos que o sistema já tem pelos do backup
                </Label>
                <Switch id="restaurar-substituir" checked={substituir} disabled={executando} onCheckedChange={setSubstituir} />
              </div>
            </div>

            {progresso ? (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  {progresso.etapa} {progresso.feitos}/{progresso.total}
                </p>
                <Progress value={progresso.total ? (progresso.feitos / progresso.total) * 100 : 0} />
              </div>
            ) : null}
            <Button disabled={executando} onClick={() => void restaurar()}>
              <DatabaseBackup className="mr-2 size-4" />
              {executando
                ? "Restaurando…"
                : `Restaurar ${recriar ? analise.aRecriar.length : 0} aluno(s) e ${arquivosRestaurar.length} arquivo(s)`}
            </Button>
          </div>
        ) : null}

        {resultado ? (
          <div role="status" className="space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{resultado.resumo}</p>
            {resultado.erros.length ? (
              <ul className="max-h-48 list-disc space-y-1 overflow-auto pl-5 text-destructive">
                {resultado.erros.map((e, i) => (
                  <li key={i} className="break-words">{e}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Validade dos links temporários de fotos e documentos nas exportações (LGPD). */
export function ValidadeLinks() {
  const config = useConfiguracaoNumero(CHAVE_VALIDADE_LINKS, VALIDADE_LINKS_PADRAO);
  const horas = validadeLinksHoras(config.valor);
  return (
    <Card className="max-w-3xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-display text-base">
          <ShieldCheck className="size-4" /> Links temporários de fotos e documentos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          As planilhas exportadas em Alunos e Relatórios trazem links que param de funcionar depois deste prazo. Nas
          telas do app, os links valem no máximo 1 hora. A planilha do backup no Drive não tem links.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link2 className="size-4 text-primary" />
          <Label htmlFor="validade-links">Validade dos links</Label>
          <Select
            value={String(horas)}
            disabled={config.carregando}
            onValueChange={(v) =>
              void config
                .salvar(Number(v))
                .then(() => toast.success(`Os links passam a valer ${v} hora(s).`))
                .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Não foi possível salvar."))
            }
          >
            <SelectTrigger id="validade-links" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPCOES_VALIDADE_LINKS.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {h === 1 ? "1 hora" : `${h} horas`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
