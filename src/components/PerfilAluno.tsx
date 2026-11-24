import { useEffect, useState } from "react";
import { toast } from "sonner";
import { UserRound, Phone, GraduationCap, Pencil, IdCard, Download, FileCheck2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SituacaoAluno } from "@/components/SituacaoAluno";
import { atestadoVencido, vencimentoAtestado } from "@/lib/atestado";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { idadePorNascimento, turnoDoHorario } from "@/lib/turnos";
import { DOCUMENTOS_PLANILHA } from "@/lib/planilha-alunos";
import { otimizarImagem } from "@/lib/imagem";

import { Button } from "@/components/ui/button";
import { ConversarWhatsApp } from "@/components/ConversarWhatsApp";
import { MensagemWhatsAppIA } from "@/components/MensagemWhatsAppIA";
import { HistoricoAluno } from "@/components/HistoricoAluno";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { dataBR, hojeISO, type Licenca } from "@/lib/licenca";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Anotacao = {
  id: string;
  texto: string;
  autor_nome: string | null;
  created_at: string;
};

type AlunoPerfil = {
  id: string;
  codigo: string;
  sexo: string | null;
  telefone2: string | null;
  escola: string | null;
  rede_ensino: string | null;
  atestado_data: string | null;
  atestado_entregue: boolean;
  nome: string;
  data_nascimento: string | null;
  telefone: string | null;
  responsavel: string | null;
  email: string | null;
  observacoes: string | null;
  ativo: boolean;
  pcd: boolean;
  pcd_descricao: string | null;
  pcd_condicoes: string[] | null;
  rg: string | null;
  cpf: string | null;
  foto_path: string | null;
  idade: number | null;
  doc_atestado_path: string | null;
  doc_residencia_path: string | null;
  doc_matricula_path: string | null;
  doc_identidade_path: string | null;
  doc_ficha_path: string | null;
  motivo_inativacao: string | null;
  inativado_em: string | null;
  inativado_por: string | null;
  inativado_por_nome?: string | null;
};

type MatriculaPerfil = {
  id: string;
  turma_id: string;
  status: string;
  modalidade: string;
  data_inicio: string;
  created_at: string;
  registrado_por: string | null;
  registrado_por_nome?: string | null;
};

type PresencaPerfil = {
  id: string;
  data: string;
  status: string;
  observacoes: string | null;
};

const DOCUMENTOS = DOCUMENTOS_PLANILHA;

const ROTULO_STATUS: Record<string, string> = {
  presente: "Presença",
  falta: "Falta",
  falta_justificada: "Falta justificada",
};

export function PerfilAluno({ alunoId, onFechar, onEditar, onCracha, onBaixar }: {
  alunoId: string | null;
  onFechar: () => void;
  onEditar?: () => void;
  onCracha?: () => void;
  onBaixar?: () => void;
}) {
  const [aluno, setAluno] = useState<AlunoPerfil | null>(null);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [docsUrls, setDocsUrls] = useState<Record<string, string>>({});
  const [matriculas, setMatriculas] = useState<MatriculaPerfil[]>([]);
  const [turmas, setTurmas] = useState<{ id: string; nome: string; horario: string | null }[]>([]);
  const [historico, setHistorico] = useState<PresencaPerfil[] | null>(null);
  const [nomesUsuarios, setNomesUsuarios] = useState<Record<string, string>>({});
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([]);
  const [novaAnotacao, setNovaAnotacao] = useState("");
  const [salvandoAnotacao, setSalvandoAnotacao] = useState(false);
  const { user } = useAuth();
  const [licencaAberta, setLicencaAberta] = useState<Licenca | null>(null);
  const [licInicio, setLicInicio] = useState("");
  const [licRetorno, setLicRetorno] = useState("");
  const [licFoto, setLicFoto] = useState<File | null>(null);
  const [salvandoLic, setSalvandoLic] = useState(false);
  const [licFotoUrl, setLicFotoUrl] = useState<string | null>(null);
  const [licMotivo, setLicMotivo] = useState("");
  const [licFormAberto, setLicFormAberto] = useState(false);
  const [licPorDias, setLicPorDias] = useState(false);
  const [licDias, setLicDias] = useState("");

  async function carregarAnotacoes(id: string) {
    const { data } = await supabase
      .from("anotacoes_alunos")
      .select("id,texto,autor_nome,created_at")
      .eq("aluno_id", id)
      .order("created_at", { ascending: false });
    setAnotacoes((data ?? []) as Anotacao[]);
  }

  async function salvarAnotacao() {
    if (!aluno || !novaAnotacao.trim()) return;
    setSalvandoAnotacao(true);
    const nome =
      (user?.user_metadata as { nome?: string } | undefined)?.nome || user?.email || "usuário";
    const { error } = await supabase.from("anotacoes_alunos").insert({
      aluno_id: aluno.id,
      texto: novaAnotacao.trim(),
      autor_id: user?.id ?? null,
      autor_nome: nome,
    });
    setSalvandoAnotacao(false);
    if (error) return toast.error(error.message);
    setNovaAnotacao("");
    toast.success("Anotação salva.");
    await carregarAnotacoes(aluno.id);
    return;
  }

  async function excluirAnotacao(id: string) {
    if (!aluno) return;
    if (!confirm("Excluir esta anotação?")) return;
    const { error } = await supabase.from("anotacoes_alunos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Anotação excluída.");
    await carregarAnotacoes(aluno.id);
    return;
  }

  async function enviarFotoLicenca(alunoIdFoto: string, original: File) {
    const arquivo = await otimizarImagem(original);
    const ext = arquivo.name.split(".").pop() ?? "jpg";
    const caminho = `${alunoIdFoto}/licenca-atestado-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("fotos-alunos").upload(caminho, arquivo, { upsert: true });
    if (up.error) throw up.error;
    return caminho;
  }

  async function anexarAtestadoLicenca(arquivo: File) {
    if (!aluno || !licencaAberta) return;
    try {
      const caminho = await enviarFotoLicenca(aluno.id, arquivo);
      const { error } = await supabase.from("licencas_medicas").update({ atestado_path: caminho }).eq("id", licencaAberta.id);
      if (error) throw error;
      toast.success("Foto do atestado salva.");
      await carregarLicenca(aluno.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar a foto");
    }
  }

  async function carregarLicenca(id: string) {
    const { data } = await supabase
      .from("licencas_medicas")
      .select("id,aluno_id,data_inicio,data_retorno,motivo,encerrada_em,atestado_path")
      .eq("aluno_id", id)
      .is("encerrada_em", null)
      .order("created_at", { ascending: false })
      .limit(1);
    const l = ((data ?? [])[0] as Licenca | undefined) ?? null;
    setLicencaAberta(l);
    setLicInicio(hojeISO());
    setLicRetorno(l?.data_retorno ?? "");
    setLicMotivo("");
    setLicFoto(null);
    setLicFotoUrl(null);
    if (l?.atestado_path) {
      const { data: s } = await supabase.storage.from("fotos-alunos").createSignedUrl(l.atestado_path, 3600);
      setLicFotoUrl(s?.signedUrl ?? null);
    }
  }

  function aplicarLicenca(l: Licenca | null) {
    setLicencaAberta(l);
    setLicInicio(hojeISO());
    setLicRetorno(l?.data_retorno ?? "");
    setLicMotivo("");
    setLicFoto(null);
  }

  async function registrarLicenca(): Promise<boolean> {
    if (!aluno || salvandoLic) return false;
    if (licRetorno <= licInicio) { toast.error("O retorno deve ser depois do início."); return false; }
    const nome = (user?.user_metadata as { nome?: string } | undefined)?.nome || user?.email || null;
    setSalvandoLic(true);
    try {
      let atestado_path: string | null = null;
      if (licFoto) atestado_path = await enviarFotoLicenca(aluno.id, licFoto);
      const { data, error } = await supabase.from("licencas_medicas").insert({
        aluno_id: aluno.id,
        data_inicio: licInicio,
        data_retorno: licRetorno,
        motivo: licMotivo.trim() || null,
        registrado_por: user?.id ?? null,
        registrado_por_nome: nome,
        atestado_path,
      }).select("id,aluno_id,data_inicio,data_retorno,motivo,encerrada_em,atestado_path").single();
      if (error) throw error;
      toast.success("Licença médica registrada.");
      aplicarLicenca(data as Licenca);
      if (atestado_path) void carregarLicenca(aluno.id);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao registrar a licença");
      return false;
    } finally {
      setSalvandoLic(false);
    }
  }

  async function prorrogarLicenca() {
    if (!aluno || !licencaAberta || salvandoLic) return;
    if (licRetorno <= licencaAberta.data_inicio) return toast.error("Data de retorno inválida.");
    setSalvandoLic(true);
    const { error } = await supabase.from("licencas_medicas").update({ data_retorno: licRetorno }).eq("id", licencaAberta.id);
    setSalvandoLic(false);
    if (error) return toast.error(error.message);
    toast.success("Licença prorrogada.");
    setLicencaAberta({ ...licencaAberta, data_retorno: licRetorno });
    return;
  }

  async function encerrarLicenca() {
    if (!aluno || !licencaAberta || salvandoLic) return;
    setSalvandoLic(true);
    const { error } = await supabase
      .from("licencas_medicas")
      .update({ encerrada_em: new Date().toISOString() })
      .eq("id", licencaAberta.id);
    setSalvandoLic(false);
    if (error) return toast.error(error.message);
    toast.success("Retorno confirmado.");
    aplicarLicenca(null);
    setLicFotoUrl(null);
    return;
  }

  useEffect(() => {
    if (!alunoId) return;
    const idSelecionado = alunoId;
    let vivo = true;
    setAluno(null);
    setFotoUrl(null);
    setDocsUrls({});
    setMatriculas([]);
    setHistorico(null);
    setNomesUsuarios({});
    setAnotacoes([]);
    setNovaAnotacao("");

    async function carregar() {
      const { data: a, error } = await supabase.from("alunos").select("*").eq("id", idSelecionado).maybeSingle();
      if (!vivo) return;
      if (error || !a) {
        toast.error(error?.message ?? "Aluno não encontrado");
        onFechar();
        return;
      }
      const perfil = a as AlunoPerfil;
      setAluno(perfil);
      void carregarAnotacoes(perfil.id);
      void carregarLicenca(perfil.id);

      const [{ data: ms }, { data: ts }, { data: ps }] = await Promise.all([
        supabase.from("matriculas").select("id,turma_id,status,modalidade,data_inicio,created_at,registrado_por,registrado_por_nome").eq("aluno_id", perfil.id),
        supabase.from("turmas").select("id,nome,horario"),
        supabase.from("presencas").select("id,data,status,observacoes").eq("aluno_id", perfil.id).order("data", { ascending: false }),
      ]);
      if (!vivo) return;
      setMatriculas((ms ?? []) as MatriculaPerfil[]);
      setTurmas((ts ?? []) as { id: string; nome: string; horario: string | null }[]);
      setHistorico((ps ?? []) as PresencaPerfil[]);

      const idsUsuarios = Array.from(
        new Set(
          [perfil.inativado_por, ...((ms ?? []) as MatriculaPerfil[]).map((m) => m.registrado_por)].filter(
            (x): x is string => !!x,
          ),
        ),
      );
      if (idsUsuarios.length) {
        const { data: profs } = await supabase.from("profiles").select("id,nome,email").in("id", idsUsuarios);
        if (!vivo) return;
        const mapa: Record<string, string> = {};
        (profs ?? []).forEach((p) => {
          mapa[p.id] = p.nome || p.email || "usuário";
        });
        setNomesUsuarios(mapa);
      }

      const caminhos = DOCUMENTOS.map((d) => ({ campo: d.campo as string, path: perfil[d.campo] })).filter((d) => d.path) as {
        campo: string;
        path: string;
      }[];
      if (perfil.foto_path) caminhos.push({ campo: "foto_path", path: perfil.foto_path });
      if (caminhos.length) {
        const { data: signed } = await supabase.storage.from("fotos-alunos").createSignedUrls(caminhos.map((c) => c.path), 3600);
        if (!vivo) return;
        const mapa: Record<string, string> = {};
        signed?.forEach((s, i) => {
          const c = caminhos[i];
          if (s.signedUrl && c) mapa[c.campo] = s.signedUrl;
        });
        setDocsUrls(mapa);
        if (mapa["foto_path"]) setFotoUrl(mapa["foto_path"]);
      }
    }
    void carregar();
    return () => {
      vivo = false;
    };
  }, [alunoId]);

  async function baixarDoc(rotulo: string, path: string, nomeAluno: string) {
    const { data, error } = await supabase.storage.from("fotos-alunos").download(path);
    if (error || !data) return toast.error(error?.message ?? "Falha ao baixar documento");
    const ext = path.split(".").pop() ?? "jpg";
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${nomeAluno} - ${rotulo}.${ext}`.replace(/\//g, "-");
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  const turmaAtiva = aluno ? turmas.find((t) => t.id === matriculas.find((m) => m.status === "ativa")?.turma_id) : undefined;

  return (
    <Dialog open={!!alunoId} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent aria-describedby={undefined} className="max-h-[90dvh] w-[calc(100%-1.5rem)] overflow-y-auto p-5 sm:max-w-4xl sm:p-7 [scrollbar-gutter:stable]">
        {!aluno ? <DialogTitle>Perfil do aluno</DialogTitle> : null}
        {!aluno ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando perfil...</p>
        ) : (
          <div className="space-y-5">
            <DialogHeader className="text-left">
              <div className="flex items-start gap-4 sm:items-center sm:gap-5">
                {fotoUrl ? (
                  <img src={fotoUrl} alt={`Foto de ${aluno.nome}`} className="size-20 shrink-0 rounded-lg object-cover sm:size-28" />
                ) : (
                  <div className="grid size-20 shrink-0 place-items-center rounded-lg bg-secondary font-display text-2xl text-secondary-foreground sm:size-28">
                    {aluno.nome.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-2 pr-4 sm:pr-0">
                  <DialogTitle className="break-words font-display text-2xl leading-tight sm:text-3xl">{aluno.nome}</DialogTitle>
                  <SituacaoAluno tom={!aluno.ativo ? "inativo" : licencaAberta ? "licenca" : "ativo"} rotulo={!aluno.ativo ? "Inativo" : licencaAberta ? "Licença médica" : "Ativo"} />
                  <p className="text-sm text-muted-foreground">Matrícula: <span className="font-medium">{aluno.codigo}</span></p>
                </div>
                <div className="hidden items-center gap-2 sm:flex">
                  {onEditar ? <Button variant="ghost" size="icon" title="Editar cadastro" aria-label="Editar cadastro" onClick={onEditar}><Pencil /></Button> : null}
                  <ConversarWhatsApp telefone={aluno.telefone} compacto />
                  {onCracha ? <Button variant="ghost" size="icon" title="Visualizar crachá" aria-label="Visualizar crachá" onClick={onCracha}><IdCard /></Button> : null}
                  {onBaixar ? <Button variant="ghost" size="icon" title="Baixar crachá" aria-label="Baixar crachá" onClick={onBaixar}><Download /></Button> : null}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 sm:hidden">
                {onEditar ? <Button variant="outline" size="icon" title="Editar cadastro" aria-label="Editar cadastro" onClick={onEditar}><Pencil /></Button> : null}
                <ConversarWhatsApp telefone={aluno.telefone} compacto />
                {onCracha ? <Button variant="outline" size="icon" title="Visualizar crachá" aria-label="Visualizar crachá" onClick={onCracha}><IdCard /></Button> : null}
                {onBaixar ? <Button variant="outline" size="icon" title="Baixar crachá" aria-label="Baixar crachá" onClick={onBaixar}><Download /></Button> : null}
              </div>
            </DialogHeader>
            <div className="grid gap-4 rounded-lg bg-secondary/60 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] sm:gap-5">
              <div className="flex min-w-0 items-center gap-3 sm:border-r sm:border-border sm:pr-5">
                <FileCheck2 className="size-5 shrink-0 text-primary" />
                <p className="break-words font-medium">{!aluno.atestado_entregue ? "Atestado não entregue" : atestadoVencido(aluno.atestado_data) ? "Atestado vencido" : vencimentoAtestado(aluno.atestado_data) ? `Atestado válido até ${vencimentoAtestado(aluno.atestado_data)?.toLocaleDateString("pt-BR")}` : "Atestado entregue · sem data"}</p>
              </div>
              <div className="flex min-w-0 items-center gap-3 border-t border-border pt-3 sm:border-t-0 sm:pt-0">
                <GraduationCap className="size-5 shrink-0 text-primary" />
                <div className="min-w-0 space-y-1">
                  <p className="text-xs text-muted-foreground">Turma atual</p>
                  <p className="break-words font-medium">{turmaAtiva?.nome ?? "Sem turma ativa"}{turmaAtiva?.horario && !turmaAtiva.nome.includes(turmaAtiva.horario) ? ` · ${turmaAtiva.horario}` : ""}</p>
                </div>
              </div>
            </div>
            <Tabs defaultValue="cadastro" className="min-w-0">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-0 rounded-none border-b bg-transparent p-0 sm:grid-cols-4">
                {[["cadastro", "Dados cadastrais"], ["matriculas", "Matrículas"], ["documentos", "Documentos"], ["historico", "Histórico"]].map(([valor, rotulo]) => (
                  <TabsTrigger key={valor} value={valor ?? ""} className="min-h-12 flex-1 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none sm:text-sm">{rotulo}</TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="cadastro" className="space-y-6 pt-5">
                <div className="grid gap-7 sm:grid-cols-2">
                  <section className="min-w-0 space-y-4">
                    <h3 className="flex items-center gap-2 border-b pb-2 text-sm font-semibold"><UserRound className="size-4 text-primary" />Dados pessoais</h3>
                    <dl className="space-y-3 text-sm">
                      {[["Nome completo", aluno.nome], ["Nascimento", aluno.data_nascimento ? dataBR(aluno.data_nascimento) : null], ["Idade", aluno.idade ?? (idadePorNascimento(aluno.data_nascimento) || null)], ["Sexo", aluno.sexo], ["RG", aluno.rg], ["CPF", aluno.cpf]].map(([rotulo, valor]) => (
                        <div key={rotulo} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3"><dt className="text-muted-foreground">{rotulo}</dt><dd className="break-words font-medium">{valor ?? "Não informado"}</dd></div>
                      ))}
                    </dl>
                  </section>
                  <div className="min-w-0 space-y-7">
                    <section className="space-y-4">
                      <h3 className="flex items-center gap-2 border-b pb-2 text-sm font-semibold"><Phone className="size-4 text-primary" />Contato</h3>
                      <dl className="space-y-3 text-sm">
                        {[["Telefone", aluno.telefone], ["Outro telefone", aluno.telefone2], ["E-mail", aluno.email], ["Responsável", aluno.responsavel]].map(([rotulo, valor]) => (
                          <div key={rotulo} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3"><dt className="text-muted-foreground">{rotulo}</dt><dd className="break-words font-medium">{valor || "Não informado"}</dd></div>
                        ))}
                      </dl>
                    </section>
                    <section className="space-y-4">
                      <h3 className="flex items-center gap-2 border-b pb-2 text-sm font-semibold"><GraduationCap className="size-4 text-primary" />Escola</h3>
                      <dl className="space-y-3 text-sm">
                        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3"><dt className="text-muted-foreground">Escola</dt><dd className="break-words font-medium">{aluno.escola || "Não informada"}</dd></div>
                        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3"><dt className="text-muted-foreground">Rede de ensino</dt><dd className="break-words font-medium">{aluno.rede_ensino || "Não informada"}</dd></div>
                      </dl>
                    </section>
                  </div>
                </div>
                <MensagemWhatsAppIA telefone={aluno.telefone} />
            <div className="space-y-2 rounded-lg border border-border/70 p-3 text-sm">
              <p className="font-medium">Licença médica</p>
              {licencaAberta ? (
                <>
                  <p className="text-muted-foreground">
                    Afastado de {dataBR(licencaAberta.data_inicio)} até {dataBR(licencaAberta.data_retorno)}
                    {licencaAberta.motivo ? ` · ${licencaAberta.motivo}` : ""}. A vaga na turma está preservada e as faltas são
                    justificadas automaticamente.
                  </p>
                  <div className="flex items-center gap-3 rounded-lg bg-secondary/50 p-2">
                    {licFotoUrl ? (
                      <a href={licFotoUrl} target="_blank" rel="noreferrer">
                        <img src={licFotoUrl} alt="Atestado da licença" className="size-12 rounded object-cover" />
                      </a>
                    ) : (
                      <div className="grid size-12 place-items-center rounded bg-muted text-xs text-muted-foreground">—</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">Foto do atestado</p>
                      <p className="text-xs text-muted-foreground">{licencaAberta.atestado_path ? "Enviada" : "Não enviada"}</p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <label className="cursor-pointer">
                        {licencaAberta.atestado_path ? "Trocar" : "Anexar"}
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void anexarAtestadoLicenca(f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Prorrogar até</Label>
                      <Input type="date" value={licRetorno} onChange={(e) => setLicRetorno(e.target.value)} className="h-8 w-40" />
                    </div>
                    <Button size="sm" variant="outline" disabled={!licRetorno || salvandoLic} onClick={() => void prorrogarLicenca()}>
                      Prorrogar
                    </Button>
                    <Button size="sm" disabled={salvandoLic} onClick={() => void encerrarLicenca()}>
                      Confirmar retorno
                    </Button>
                  </div>
                </>
              ) : !licFormAberto ? (
                <Button size="sm" variant="outline" onClick={() => { setLicInicio(licInicio || hojeISO()); setLicFormAberto(true); }}>
                  Registrar Licença Médica
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Data de início</Label>
                    <Input type="date" value={licInicio} onChange={(e) => setLicInicio(e.target.value)} className="h-9" />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={licPorDias} onCheckedChange={setLicPorDias} /> Informar período em dias
                  </label>
                  {licPorDias ? (
                    <div className="space-y-1">
                      <Label className="text-xs">Período (dias)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={licDias}
                        onChange={(e) => {
                          setLicDias(e.target.value);
                          const n = Number(e.target.value);
                          if (licInicio && n > 0) {
                            const d = new Date(`${licInicio}T00:00:00`);
                            d.setDate(d.getDate() + n);
                            setLicRetorno(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
                          } else setLicRetorno("");
                        }}
                        className="h-9"
                      />
                      {licRetorno ? <p className="text-xs text-muted-foreground">Retorno previsto: {dataBR(licRetorno)}</p> : null}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Label className="text-xs">Data prevista de retorno</Label>
                      <Input type="date" value={licRetorno} onChange={(e) => setLicRetorno(e.target.value)} className="h-9" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs">Motivo / Diagnóstico resumido</Label>
                    <Input placeholder="Ex.: cirurgia no ombro, fratura..." value={licMotivo} onChange={(e) => setLicMotivo(e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Anexo do atestado / laudo médico</Label>
                    <Input type="file" accept="image/*,application/pdf" className="h-9" onChange={(e) => setLicFoto(e.target.files?.[0] ?? null)} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!licInicio || !licRetorno || salvandoLic} onClick={() => void registrarLicenca().then((ok) => { if (ok) setLicFormAberto(false); })}>
                      {salvandoLic ? "Registrando..." : "Confirmar"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setLicFormAberto(false); setLicFoto(null); }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {aluno.observacoes ? (
              <div className="rounded-lg border border-border/70 p-3 text-sm">
                <p className="mb-1 font-medium">Observações</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{aluno.observacoes}</p>
              </div>
            ) : null}

            <section className="border-t pt-4 text-sm">
              <p className="mb-1 font-medium">PCD</p>
              <p className="text-muted-foreground">{aluno.pcd ? aluno.pcd_descricao || "Sim" : "Não"}</p>
              {aluno.pcd && (aluno.pcd_condicoes ?? []).length ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted-foreground">
                  {(aluno.pcd_condicoes ?? []).map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : null}
            </section>

            {!aluno.ativo ? (
              <div className="space-y-1 text-sm">
                <p className="text-sm font-medium">Inativação</p>
                <p className="text-muted-foreground">{aluno.motivo_inativacao ?? "Motivo não informado"}</p>
                {aluno.inativado_em ? (
                  <p className="text-xs text-muted-foreground">
                    Inativado em {new Date(aluno.inativado_em).toLocaleDateString("pt-BR")} às{" "}
                    {new Date(aluno.inativado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    {aluno.inativado_por || aluno.inativado_por_nome ? ` por ${aluno.inativado_por_nome ?? nomesUsuarios[aluno.inativado_por ?? ""] ?? "usuário"}` : ""}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-2">
              <p className="text-sm font-medium">Anotações</p>
              <Textarea
                rows={3}
                placeholder="Escreva uma anotação sobre o aluno..."
                value={novaAnotacao}
                onChange={(e) => setNovaAnotacao(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" disabled={salvandoAnotacao || !novaAnotacao.trim()} onClick={() => void salvarAnotacao()}>
                  {salvandoAnotacao ? "Salvando..." : "Salvar"}
                </Button>
                <Button size="sm" variant="ghost" disabled={!novaAnotacao} onClick={() => setNovaAnotacao("")}>
                  Limpar
                </Button>
              </div>
              {anotacoes.length ? (
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-2 pr-3 [scrollbar-gutter:stable]">

                  {anotacoes.map((n) => (
                    <div key={n.id} className="rounded-lg bg-secondary/50 px-3 py-2 text-sm">
                      <p className="whitespace-pre-wrap">{n.texto}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          {new Date(n.created_at).toLocaleDateString("pt-BR")} às{" "}
                          {new Date(n.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          {n.autor_nome ? ` · ${n.autor_nome}` : ""}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-auto px-2 py-1 text-xs text-destructive"
                          onClick={() => void excluirAnotacao(n.id)}
                        >
                          Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma anotação.</p>
              )}
            </div>

              </TabsContent>
              <TabsContent value="matriculas" className="space-y-5 pt-5">
            <div className="space-y-2">
              <p className="text-sm font-medium">Matrículas</p>
              {matriculas.length ? (
                matriculas.map((m) => (
                  <div key={m.id} className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                    <p className="font-medium">{turmas.find((t) => t.id === m.turma_id)?.nome ?? "Turma"}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.modalidade} · {m.status}
                      {m.data_inicio ? ` · início ${new Date(`${m.data_inicio}T00:00:00`).toLocaleDateString("pt-BR")}` : ""}
                    </p>
                    {m.created_at ? (
                      <p className="text-xs text-muted-foreground">
                        Matriculado em {new Date(m.created_at).toLocaleDateString("pt-BR")} às{" "}
                        {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {m.registrado_por || m.registrado_por_nome ? ` por ${m.registrado_por_nome ?? nomesUsuarios[m.registrado_por ?? ""] ?? "usuário"}` : ""}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Sem matrícula ativa.</p>
              )}
            </div>

              </TabsContent>
              <TabsContent value="documentos" className="space-y-5 pt-5">
            <div className="rounded-lg border border-border/70 p-3 text-sm">
              <p className="mb-1 font-medium">Documentos</p>
              <p className="mb-3 text-muted-foreground">
                RG: {aluno.rg ?? "-"} · CPF: {aluno.cpf ?? "-"}
              </p>
              <div className="mb-3 space-y-2">
                {DOCUMENTOS.map((d) => {
                  const path = aluno[d.campo];
                  const url = docsUrls[d.campo];
                  return (
                    <div key={d.campo} className="flex items-center gap-3 rounded-lg bg-secondary/50 p-2">
                      {url ? (
                        <a href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt={d.rotulo} className="size-12 rounded object-cover" />
                        </a>
                      ) : (
                        <div className="grid size-12 place-items-center rounded bg-muted text-xs text-muted-foreground">—</div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{d.rotulo}</p>
                        <p className="text-xs text-muted-foreground">{path ? "Enviado" : "Não enviado"}</p>
                      </div>
                      {path ? (
                        <Button size="sm" variant="outline" onClick={() => void baixarDoc(d.rotulo, path, aluno.nome)}>
                          Baixar
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>

            </div>
              </TabsContent>
              <TabsContent value="historico" className="space-y-5 pt-5">
            <HistoricoAluno alunoId={aluno.id} />

            <div className="space-y-2">
              <p className="text-sm font-medium">Histórico de frequência</p>
              {historico === null ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : historico.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum registro de frequência.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {(["presente", "falta", "falta_justificada"] as const).map((st) => (
                      <div key={st} className="rounded-lg border border-border/70 py-2">
                        <p className="font-display text-lg">{historico.filter((h) => h.status === st).length}</p>
                        <p className="text-xs text-muted-foreground">{ROTULO_STATUS[st]}</p>
                      </div>
                    ))}
                  </div>
                  <div className="max-h-56 space-y-1 overflow-y-auto">
                    {historico.map((h) => (
                      <div key={h.id} className="rounded-lg bg-secondary/50 px-3 py-1.5 text-sm">
                        <div className="flex items-center justify-between">
                          <span>{new Date(`${h.data}T00:00:00`).toLocaleDateString("pt-BR")}</span>
                          <span className="text-muted-foreground">{ROTULO_STATUS[h.status] ?? h.status}</span>
                        </div>
                        {h.observacoes ? <p className="mt-0.5 text-xs text-muted-foreground">Obs.: {h.observacoes}</p> : null}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
