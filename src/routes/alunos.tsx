import { createFileRoute } from "@tanstack/react-router";

import { useEffect, useRef, useState } from "react";
import { Plus, Search, Pencil, Image as ImageIcon, AlertTriangle, Bell, Trash2, UserX, UserCheck, Download, Camera, Upload, IdCard, FileDown, FileSpreadsheet, ChevronDown, ChevronUp, X, MoreHorizontal, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { CONDICOES_PCD } from "@/lib/pcd";
import { escolasDaRede } from "@/lib/escolas";
import { useHorarios } from "@/lib/horarios";
import { useGruposDias } from "@/lib/dias";
import { capitalizarNome, formatarCelular, formatarCPF, cpfValido, correspondeBusca, relevanciaBusca } from "@/lib/formatacao";
import { cn } from "@/lib/utils";
import { encontrarAlunoDuplicado } from "@/lib/duplicidade";
import { TURNOS, turnoDoHorario, idadePorNascimento, faixaEtariaECA } from "@/lib/turnos";
import { gerarCrachaPreviewImagem, gerarCrachasPdfFielAoPreview, type DadosCracha } from "@/lib/cracha";
import { atestadoVencido, diasParaVencer, notificarAtestadoVencido, notificarAtestadoVencendo } from "@/lib/atestado";
import { PerfilAluno } from "@/components/PerfilAluno";
import { SituacaoAluno, pontoSituacao, type TomSituacao } from "@/components/SituacaoAluno";
import { hojeISO, licencaEmVigor, type Licenca } from "@/lib/licenca";
import { AvisoLicencas } from "@/components/AvisoLicencas";
import { PainelNotificacoes } from "@/components/painel/PainelNotificacoes";
import { usePrazoAvisoAtestado } from "@/lib/configuracoes";
import { useAuth } from "@/lib/auth";
import { usePermissoesProfessor, permissaoAtiva } from "@/lib/permissoes";
import { DOCUMENTOS_PLANILHA, montarPlanilhaAlunos, ExportacaoCancelada, type AlunoPlanilha } from "@/lib/planilha-alunos";
import { linksArquivosFn } from "@/lib/links-arquivos.functions";
import { otimizarImagem } from "@/lib/imagem";


import { AppShell } from "@/components/AppShell";
import { ImportarAlunos } from "@/components/ImportarAlunos";
import { ConversarWhatsApp } from "@/components/ConversarWhatsApp";
import { SelecionarEscola } from "@/components/SelecionarEscola";
import { LeitorFicha } from "@/components/LeitorFicha";
import { MensagemWhatsAppIA } from "@/components/MensagemWhatsAppIA";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FotoAmpliavel } from "@/components/FotoAmpliavel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { enfileirar, estaOnline, lerCache, salvarCache } from "@/lib/offline";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/alunos")({
  component: AlunosPage,
  validateSearch: (s: Record<string, unknown>): { nova?: boolean; notificacao?: string } => ({
    ...(s["nova"] === true || s["nova"] === "true" || s["nova"] === 1 ? { nova: true } : {}),
    ...(typeof s["notificacao"] === "string" ? { notificacao: s["notificacao"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Alunos e matrículas | Arena Aquática" },
      { name: "description", content: "Cadastre alunos, faça matrículas em turmas e gere o QR Code de presença." },
      { property: "og:title", content: "Alunos e matrículas | Arena Aquática" },
      { property: "og:description", content: "Cadastro de alunos e matrículas da Arena Aquática." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Aluno = {
  id: string;
  nome: string;
  data_nascimento: string | null;
  telefone: string | null;
  responsavel: string | null;
  email: string | null;
  observacoes: string | null;
  codigo: string;
  ativo: boolean;
  pcd: boolean;
  pcd_descricao: string | null;
  pcd_condicoes: string[] | null;
  rg: string | null;
  cpf: string | null;
  foto_path: string | null;
  atestado_entregue: boolean;
  atestado_data: string | null;
  telefone2: string | null;
  rede_ensino: string | null;
  escola: string | null;
  idade: number | null;
  sexo: string | null;
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

function gerarCodigoMatricula(codigosExistentes: Set<string>) {
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const numeros = "23456789";
  const caracteres = `${letras}${numeros}`;
  const indiceAleatorio = (limite: number) => (crypto.getRandomValues(new Uint32Array(1)).at(0) ?? 0) % limite;

  do {
    const codigo = [
      letras.charAt(indiceAleatorio(letras.length)),
      numeros.charAt(indiceAleatorio(numeros.length)),
      ...Array.from({ length: 5 }, () => caracteres.charAt(indiceAleatorio(caracteres.length))),
    ];
    for (let i = codigo.length - 1; i > 0; i--) {
      const j = indiceAleatorio(i + 1);
      const atual = codigo[i];
      const troca = codigo[j];
      if (atual !== undefined && troca !== undefined) [codigo[i], codigo[j]] = [troca, atual];
    }
    const resultado = codigo.join("");
    if (!codigosExistentes.has(resultado)) return resultado;
  } while (true);
}

const DOCUMENTOS = DOCUMENTOS_PLANILHA;

type CampoDoc = (typeof DOCUMENTOS)[number]["campo"];

const CAPACIDADE_TURMA = 40;

const ROTULO_STATUS = {
  presente: "Presenças",
  falta: "Faltas",
  falta_justificada: "Faltas justificadas",
} as const;

type Turma = { id: string; nome: string; horario: string | null; dias_semana: string[] | null; modalidade: string | null; capacidade: number | null };
type Matricula = { id: string; aluno_id: string; turma_id: string; status: string; modalidade: string; data_inicio: string | null; created_at: string | null; registrado_por: string | null; registrado_por_nome?: string | null };
type Presenca = { id: string; data: string; status: string; turma_id: string | null; observacoes: string | null };


const vazio = {
  nome: "",
  data_nascimento: "",
  telefone: "",
  responsavel: "",
  email: "",
  observacoes: "",
  modalidade: "Natação",
  pcd: false,
  pcd_descricao: "",
  pcd_condicoes: [] as string[],
  rg: "",
  cpf: "",
  atestado_entregue: false,
  atestado_data: "",
  telefone2: "",
  rede_ensino: "",
  escola: "",
  idade: "",
  sexo: "",
};


function AlunosPage() {
  const { lista: listaHorarios } = useHorarios();
  const { lista: listaGrupos } = useGruposDias();
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroPcd, setFiltroPcd] = useState("todos");
  const [filtroSexo, setFiltroSexo] = useState("todos");
  const [filtroModalidade, setFiltroModalidade] = useState("todas");
  const [filtrosHorario, setFiltrosHorario] = useState<string[]>([]);
  const [filtroDias, setFiltroDias] = useState("todos");
  const [filtroTurno, setFiltroTurno] = useState("todos");
  const [turnoForm, setTurnoForm] = useState("todos");
  const [filtroNotificacao, setFiltroNotificacao] = useState<
    "todos" | "ativos" | "em_licenca" | "inativos" | "sem_atestado" | "atestado_vencido" | "atestado_vencer" | "excesso_faltas"
  >("todos");
  const [emLicenca, setEmLicenca] = useState<Set<string>>(new Set());
  const [filtrosCelular, setFiltrosCelular] = useState(false);
  useEffect(() => {
    void supabase
      .from("licencas_medicas")
      .select("id,aluno_id,data_inicio,data_retorno,motivo,encerrada_em")
      .is("encerrada_em", null)
      .then(({ data }) => {
        const hoje = hojeISO();
        setEmLicenca(new Set(((data ?? []) as Licenca[]).filter((l) => licencaEmVigor(l, hoje)).map((l) => l.aluno_id)));
      });
  }, []);
  const [listasNotificacoes, setListasNotificacoes] = useState<Record<string, boolean>>({
    inativos: false,
    sem_atestado: false,
    atestado_vencido: false,
    atestado_vencer: false,
    excesso_faltas: false,
  });
  const { valor: prazoAviso } = usePrazoAvisoAtestado();
  const { nova: abrirNovaParam, notificacao: notificacaoParam } = Route.useSearch();
  const navigateAlunos = Route.useNavigate();
  const [gerandoCrachas, setGerandoCrachas] = useState(false);
  const [mostrarGuias, setMostrarGuias] = useState(false);
  const { user, isAdmin, isStaff, loading: authLoading } = useAuth();
  const { mapa: permissoes, carregando: permissoesLoading } = usePermissoesProfessor();
  const permitido = (chave: string) => !authLoading && (isAdmin || (isStaff && !permissoesLoading && permissaoAtiva(permissoes, chave)));
  const [nomesUsuarios, setNomesUsuarios] = useState<Record<string, string>>({});

  const [idadeMin, setIdadeMin] = useState("");
  const [idadeMax, setIdadeMax] = useState("");
  const [docs, setDocs] = useState<Record<CampoDoc, File | null>>({
    doc_atestado_path: null,
    doc_residencia_path: null,
    doc_matricula_path: null,
    doc_identidade_path: null,
    doc_ficha_path: null,
  });
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Aluno | null>(null);
  const [form, setForm] = useState(vazio);
  const [turmaId, setTurmaId] = useState<string>("");
  const [qrAluno, setQrAluno] = useState<Aluno | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [detalhe, setDetalhe] = useState<Aluno | null>(null);
  const [perfilLicencaId, setPerfilLicencaId] = useState<string | null>(null);
  const [docsUrls, setDocsUrls] = useState<Record<string, string>>({});

  const [historico, setHistorico] = useState<Presenca[] | null>(null);
  const [mostrarNotificacoes, setMostrarNotificacoes] = useState(false);
  const [faltasPorAluno, setFaltasPorAluno] = useState<Record<string, number>>({});
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [confirmarExclusao, setConfirmarExclusao] = useState<Aluno[] | null>(null);
  const [inativando, setInativando] = useState<Aluno[] | null>(null);
  const [motivoInativacao, setMotivoInativacao] = useState("");
  const [exportandoPlanilha, setExportandoPlanilha] = useState(false);
  const [progressoPlanilha, setProgressoPlanilha] = useState<{ etapa: string; feitos: number; total: number } | null>(null);
  const cancelarPlanilhaRef = useRef<AbortController | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    if (!estaOnline()) {
      const c = await lerCache<{ alunos: Aluno[]; turmas: Turma[]; matriculas: Matricula[] }>("alunos");
      if (c) {
        setAlunos(c.alunos ?? []);
        setTurmas(c.turmas ?? []);
        setMatriculas(c.matriculas ?? []);
      } else {
        setErro("Sem conexão e sem dados salvos neste aparelho.");
      }
      setCarregando(false);
      return;
    }
    try {
      const [a, t, m] = await Promise.all([
        supabase.from("alunos").select("*").order("nome"),
        supabase.from("turmas").select("id,nome,horario,dias_semana,modalidade,capacidade").order("nome"),
        supabase.from("matriculas").select("*"),
      ]);
      if (a.error) throw a.error;
      if (t.error) throw t.error;
      if (m.error) throw m.error;
      setAlunos(a.data as Aluno[]);
      setTurmas(t.data as Turma[]);
      setMatriculas(m.data as Matricula[]);
      void salvarCache("alunos", { alunos: a.data, turmas: t.data, matriculas: m.data });
      const perfis = await supabase.from("profiles").select("id,nome,email");
      if (perfis.data) {
        const mapa: Record<string, string> = {};
        for (const p of perfis.data as { id: string; nome: string | null; email: string | null }[]) {
          mapa[p.id] = p.nome || p.email || "Usuário";
        }
        setNomesUsuarios(mapa);
      }
      const f = await supabase.from("presencas").select("aluno_id").eq("status", "falta");
      if (f.data) {
        const contagem: Record<string, number> = {};
        for (const row of f.data as { aluno_id: string }[]) {
          contagem[row.aluno_id] = (contagem[row.aluno_id] ?? 0) + 1;
        }
        setFaltasPorAluno(contagem);
      }
      const comFoto = (a.data as Aluno[]).filter((x) => x.foto_path);
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
    } catch (err: any) {
      setErro(err?.message ?? "Erro ao carregar dados");
      toast.error(err?.message ?? "Erro ao carregar dados");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);


  function limparDocs() {
    setDocs({ doc_atestado_path: null, doc_residencia_path: null, doc_matricula_path: null, doc_identidade_path: null, doc_ficha_path: null });
  }

  async function excluirDocumento(campo: CampoDoc, rotulo: string) {
    if (!permitido(editando ? "alunos_editar" : "alunos_cadastrar")) return;
    const enviado = editando?.[campo] ?? null;
    if (!confirm(`Excluir ${rotulo.toLowerCase()}?`)) return;
    setDocs((s) => ({ ...s, [campo]: null }));
    const input = document.getElementById(`doc-${campo}`) as HTMLInputElement | null;
    if (input) input.value = "";
    if (!enviado || !editando) return toast.success("Arquivo selecionado removido");
    const patch = { [campo]: null } as Partial<Record<CampoDoc, string | null>>;
    const { error } = await supabase.from("alunos").update(patch).eq("id", editando.id);
    if (error) return toast.error(error.message);
    await supabase.storage.from("fotos-alunos").remove([enviado]);
    setEditando({ ...editando, [campo]: null });
    toast.success("Documento excluído");
    void carregar();
    return;
  }

  async function excluirFoto() {
    if (!permitido(editando ? "alunos_editar" : "alunos_cadastrar")) return;
    const enviada = editando?.foto_path ?? null;
    if (!foto && !enviada) return;
    if (!confirm("Excluir a foto do aluno?")) return;
    setFoto(null);
    setFotoPreview(null);
    (document.getElementById("foto-aluno-arquivo") as HTMLInputElement | null) && ((document.getElementById("foto-aluno-arquivo") as HTMLInputElement).value = "");
    (document.getElementById("foto-aluno-camera") as HTMLInputElement | null) && ((document.getElementById("foto-aluno-camera") as HTMLInputElement).value = "");
    if (!enviada || !editando) return toast.success("Foto removida");
    const { error } = await supabase.from("alunos").update({ foto_path: null }).eq("id", editando.id);
    if (error) return toast.error(error.message);
    await supabase.storage.from("fotos-alunos").remove([enviada]);
    setEditando({ ...editando, foto_path: null });
    setFotos((m) => { const novo = { ...m }; delete novo[editando.id]; return novo; });
    toast.success("Foto excluída");
    void carregar();
    return;
  }

  useEffect(() => {
    if ((!abrirNovaParam && !notificacaoParam) || authLoading || permissoesLoading) return;
    const validos = ["inativos", "sem_atestado", "atestado_vencido", "atestado_vencer", "excesso_faltas"];
    if (notificacaoParam && validos.includes(notificacaoParam)) setFiltroNotificacao(notificacaoParam as typeof filtroNotificacao);
    if (abrirNovaParam) abrirNovo();
    void navigateAlunos({ search: {}, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirNovaParam, notificacaoParam, authLoading, permissoesLoading]);

  function abrirNovo() {
    if (!permitido("alunos_cadastrar")) return;
    setEditando(null);
    setForm(vazio);
    setTurmaId("");
    setTurnoForm("todos");

    setFoto(null);
    setFotoPreview(null);
    limparDocs();
    setAberto(true);
  }

  function abrirEdicao(aluno: Aluno) {
    if (!permitido("alunos_editar")) return;
    setEditando(aluno);
    setForm({
      nome: aluno.nome,
      data_nascimento: aluno.data_nascimento ?? "",
      telefone: aluno.telefone ?? "",
      responsavel: aluno.responsavel ?? "",
      email: aluno.email ?? "",
      observacoes: aluno.observacoes ?? "",
      modalidade: "Natação",
      pcd: aluno.pcd ?? false,
      pcd_descricao: aluno.pcd_descricao ?? "",
      pcd_condicoes: aluno.pcd_condicoes ?? [],
      rg: aluno.rg ?? "",
      cpf: aluno.cpf ?? "",
      atestado_entregue: aluno.atestado_entregue ?? false,
      atestado_data: aluno.atestado_data ?? "",
      telefone2: aluno.telefone2 ?? "",
      rede_ensino: aluno.rede_ensino ?? "",
      escola: aluno.escola ?? "",
      idade: aluno.idade != null ? String(aluno.idade) : "",
      sexo: aluno.sexo ?? "",
    });
    setFoto(null);
    limparDocs();
    setFotoPreview(fotos[aluno.id] ?? null);
    const m = matriculas.find((x) => x.aluno_id === aluno.id && x.status === "ativa") ?? matriculas.find((x) => x.aluno_id === aluno.id);
    setTurmaId(m?.turma_id ?? "");
    setTurnoForm(turnoDoHorario(turmas.find((t) => t.id === m?.turma_id)?.horario) || "todos");
    // A modalidade da turma é a fonte de verdade (há turmas de Natação e Hidroginástica no mesmo horário)
    setForm((f) => ({ ...f, modalidade: turmas.find((t) => t.id === m?.turma_id)?.modalidade ?? m?.modalidade ?? "Natação" }));


    setAberto(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!permitido(editando ? "alunos_editar" : "alunos_cadastrar")) return;
    const temAtestadoAnexado = Boolean(docs.doc_atestado_path || editando?.doc_atestado_path);
    if (temAtestadoAnexado && !form.atestado_entregue) {
      toast.error('Marque o campo "Entregou atestado?" para continuar.');
      document.getElementById("atestado")?.focus();
      return;
    }
    if (temAtestadoAnexado && !form.atestado_data) {
      toast.error("Informe a data do atestado médico para continuar.");
      document.getElementById("atestado-data")?.focus();
      return;
    }
    if (form.cpf && !cpfValido(form.cpf)) {
      toast.error("CPF inválido. Verifique os números digitados.");
      return;
    }
    // Critério único (mesmo aplicado no banco de dados): CPF ou nome + data de nascimento.
    const duplicado = encontrarAlunoDuplicado(
      { nome: capitalizarNome(form.nome), cpf: form.cpf, data_nascimento: form.data_nascimento },
      alunos,
      editando?.id ?? null,
    );
    if (duplicado) {
      toast.error(`Aluno já cadastrado: ${duplicado.nome}.`);
      return;
    }


    const payload = {
      nome: capitalizarNome(form.nome),
      data_nascimento: form.data_nascimento || null,
      telefone: form.telefone || null,
      responsavel: form.responsavel || null,
      email: form.email || null,
      observacoes: form.observacoes || null,
      pcd: form.pcd,
      pcd_descricao: form.pcd ? form.pcd_descricao || null : null,
      pcd_condicoes: form.pcd ? form.pcd_condicoes : [],
      rg: form.rg || null,
      cpf: form.cpf || null,
      atestado_entregue: form.atestado_entregue,
      atestado_data: form.atestado_entregue ? form.atestado_data || null : null,
      telefone2: form.telefone2 || null,
      rede_ensino: form.rede_ensino || null,
      escola: form.escola || null,
      idade: form.idade ? Number(form.idade) : null,
      sexo: form.sexo || null,
    };
    const codigoNovo = editando ? null : gerarCodigoMatricula(new Set(alunos.map((aluno) => aluno.codigo)));
    const payloadNovo = codigoNovo ? { ...payload, codigo: codigoNovo } : payload;

    if (turmaId) {
      const jaMatriculado = matriculas.some((m) => m.aluno_id === editando?.id && m.turma_id === turmaId);
      const ocupadas = matriculas.filter((m) => m.turma_id === turmaId && m.status === "ativa").length;
      const capacidade = turmas.find((t) => t.id === turmaId)?.capacidade ?? CAPACIDADE_TURMA;
      if (!jaMatriculado && ocupadas >= capacidade) {
        toast.error(`Turma lotada (${capacidade} vagas por horário).`);
        return;
      }
      // CPF não bloqueia: famílias usam o CPF do responsável para vários alunos.


    }
    setSalvando(true);

    if (!estaOnline()) {
      const idLocal = editando?.id ?? crypto.randomUUID();
      if (editando) {
        await enfileirar({ tipo: "aluno_update", aluno_id: idLocal, dados: payload, foto: foto ?? null, fotoNome: foto?.name ?? null });
        setAlunos((lista) => lista.map((a) => (a.id === idLocal ? ({ ...a, ...payload } as Aluno) : a)));
      } else {
        await enfileirar({ tipo: "aluno_novo", aluno: { id: idLocal, ...payloadNovo }, foto: foto ?? null, fotoNome: foto?.name ?? null });
        setAlunos((lista) => [...lista, { id: idLocal, ativo: true, ...payloadNovo } as unknown as Aluno]);
      }
      if (turmaId) {
        await enfileirar({ tipo: "matricula", aluno_id: idLocal, turma_id: turmaId, modalidade: form.modalidade, registrado_por: user?.id ?? null });
        setMatriculas((lista) => [
          ...lista.filter((m) => m.aluno_id !== idLocal),
          { aluno_id: idLocal, turma_id: turmaId, status: "ativa", modalidade: form.modalidade } as unknown as Matricula,
        ]);
      }
      setSalvando(false);
      setAberto(false);
      toast.success("Salvo offline. Será enviado quando a internet voltar.");
      return;
    }

    let alunoId = editando?.id;
    try {
      if (editando) {
        const { error } = await supabase.from("alunos").update(payload).eq("id", editando.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("alunos").insert(payloadNovo).select("id").single();
        if (error) throw error;
        alunoId = data.id;
      }

      if (foto && alunoId) {
        const ext = foto.name.split(".").pop() ?? "jpg";
        const caminho = `${alunoId}/${Date.now()}.${ext}`;
        const up = await supabase.storage.from("fotos-alunos").upload(caminho, foto, { upsert: true });
        if (up.error) throw up.error;
        const { error } = await supabase.from("alunos").update({ foto_path: caminho }).eq("id", alunoId);
        if (error) throw error;
      }

      const atualizacaoDocs: Partial<Record<CampoDoc, string>> = {};
      for (const d of DOCUMENTOS) {
        const arquivo = docs[d.campo];
        if (!arquivo || !alunoId) continue;
        const ext = arquivo.name.split(".").pop() ?? "jpg";
        const caminho = `${alunoId}/${d.campo}-${Date.now()}.${ext}`;
        const up = await supabase.storage.from("fotos-alunos").upload(caminho, arquivo, { upsert: true });
        if (up.error) throw up.error;
        atualizacaoDocs[d.campo] = caminho;
      }
      if (Object.keys(atualizacaoDocs).length && alunoId) {
        const { error } = await supabase.from("alunos").update(atualizacaoDocs).eq("id", alunoId);
        if (error) throw error;
      }

    } catch (err: any) {
      setSalvando(false);
      toast.error(err?.message ?? "Erro ao salvar");
      return;
    }

    if (turmaId && alunoId) {
      // Um aluno só pode estar em uma turma
      const { error: eDel } = await supabase
        .from("matriculas")
        .delete()
        .eq("aluno_id", alunoId)
        .neq("turma_id", turmaId);
      if (eDel) {
        setSalvando(false);
        return toast.error(eDel.message);
      }
      const { error } = await supabase.from("matriculas").upsert(
        { aluno_id: alunoId, turma_id: turmaId, status: "ativa", modalidade: form.modalidade, registrado_por: user?.id ?? null },
        { onConflict: "aluno_id,turma_id" },
      );
      if (error) {
        setSalvando(false);
        return toast.error(error.message);
      }
    }


    setSalvando(false);
    toast.success(editando ? "Aluno atualizado" : "Aluno matriculado com sucesso");
    setAberto(false);
    void carregar();
    return;
  }

  async function abrirDetalhe(aluno: Aluno) {
    setDetalhe(aluno);
    setHistorico(null);
    setDocsUrls({});
    const caminhos = DOCUMENTOS
      .map((d) => ({ campo: d.campo as string, path: aluno[d.campo] }))
      .filter((d) => d.path) as { campo: string; path: string }[];

    if (caminhos.length) {
      const { data: signed } = await supabase.storage
        .from("fotos-alunos")
        .createSignedUrls(caminhos.map((c) => c.path), 3600);
      const mapa: Record<string, string> = {};
      signed?.forEach((s, i) => {
        const c = caminhos[i];
        if (s.signedUrl && c) mapa[c.campo] = s.signedUrl;
      });
      setDocsUrls(mapa);
    }
    const { data, error } = await supabase
      .from("presencas")
      .select("id,data,status,turma_id,observacoes")
      .eq("aluno_id", aluno.id)
      .order("data", { ascending: false });
    if (error) {
      toast.error(error.message);
      setHistorico([]);
      return;
    }
    setHistorico((data ?? []) as Presenca[]);
  }

  async function baixarDoc(campo: string, rotulo: string, path: string, nomeAluno: string) {
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


  function vagasUsadas(id: string) {
    return matriculas.filter((m) => m.turma_id === id && m.status === "ativa").length;
  }

  function capacidadeTurma(id: string) {
    return turmas.find((t) => t.id === id)?.capacidade ?? CAPACIDADE_TURMA;
  }

  const gruposDeTurmas = (() => {
    const porModalidade = turmas.filter(
      (t) =>
        (t.modalidade ?? "Natação") === form.modalidade &&
        (turnoForm === "todos" || turnoDoHorario(t.horario) === turnoForm),
    );
    const usadas = new Set<string>();
    const grupos = listaGrupos.map((g) => {
      const doGrupo = porModalidade.filter((t) => {
        const dias = t.dias_semana ?? [];
        const casa = g.dias.length
          ? g.dias.every((d) => dias.includes(d))
          : t.nome.toLowerCase().startsWith(g.label.toLowerCase());
        if (casa) usadas.add(t.id);
        return casa;
      });
      return { label: g.label, turmas: doGrupo };
    });
    const restantes = porModalidade.filter((t) => !usadas.has(t.id));
    if (restantes.length) grupos.push({ label: "Outros dias", turmas: restantes });
    return grupos.filter((g) => g.turmas.length);
  })();


  async function excluirAlunos(lista: Aluno[]) {
    if (!permitido("alunos_excluir")) return;
    const ids = lista.map((a) => a.id);
    if (!ids.length) return;
    const caminhos = lista.map((a) => a.foto_path).filter(Boolean) as string[];
    // Lotes pequenos evitam o erro 400 (URL longa demais) ao excluir muitos alunos
    try {
      for (let i = 0; i < ids.length; i += 40) {
        const lote = ids.slice(i, i + 40);
        // As relações são removidas em cascata, sob a permissão de excluir o aluno.
        const a = await supabase.from("alunos").delete().in("id", lote);
        if (a.error) throw a.error;
      }
      for (let i = 0; i < caminhos.length; i += 40) {
        await supabase.storage.from("fotos-alunos").remove(caminhos.slice(i, i + 40));
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao excluir alunos");
      return;
    }
    toast.success(ids.length > 1 ? `${ids.length} alunos excluídos` : "Aluno excluído");
    setSelecionados([]);
    setConfirmarExclusao(null);
    void carregar();
    return;
  }



  async function alternarAtivo(lista: Aluno[], ativo: boolean) {
    if (!permitido(ativo ? "alunos_reativar" : "alunos_inativar")) return;
    if (!ativo) {
      setMotivoInativacao("");
      setInativando(lista);
      return;
    }
    const ids = lista.map((a) => a.id);
    const { error } = await supabase
      .from("alunos")
      .update({ ativo: true, motivo_inativacao: null, inativado_em: null, inativado_por: null })
      .in("id", ids);
    if (error) return toast.error(error.message);
    toast.success("Aluno(s) reativado(s)");
    setSelecionados([]);
    void carregar();
    return;
  }

  async function confirmarInativacao() {
    if (!permitido("alunos_inativar")) return;
    if (!inativando?.length) return;
    if (!motivoInativacao.trim()) return toast.error("Informe o motivo da inativação.");
    const ids = inativando.map((a) => a.id);
    const { error } = await supabase
      .from("alunos")
      .update({
        ativo: false,
        motivo_inativacao: motivoInativacao.trim(),
        inativado_em: new Date().toISOString(),
        inativado_por: user?.id ?? null,
      })
      .in("id", ids);
    if (error) return toast.error(error.message);
    const { error: erroMatricula } = await supabase.from("matriculas").delete().in("aluno_id", ids);
    if (erroMatricula) return toast.error(erroMatricula.message);
    toast.success(ids.length > 1 ? "Alunos inativados e removidos das turmas" : "Aluno inativado e removido da turma");
    setInativando(null);
    setMotivoInativacao("");
    setSelecionados([]);
    void carregar();
    return;
  }


  function matriculaDoAluno(id: string) {
    return matriculas.find((m) => m.aluno_id === id);
  }

  function turmaDoAluno(id: string) {
    const m = matriculaDoAluno(id);
    return m ? turmas.find((t) => t.id === m.turma_id) : undefined;
  }

  function dadosCracha(a: Aluno): DadosCracha {
    const t = turmaDoAluno(a.id);
    return {
      nome: a.nome,
      rg: a.rg,
      cpf: a.cpf,
      responsavel: a.responsavel,
      telefone: a.telefone,
      pcd: a.pcd,
      modalidade: matriculaDoAluno(a.id)?.modalidade ?? t?.modalidade ?? "",
      horario: t?.horario ?? "",
      dias: t?.dias_semana ?? [],
      fotoUrl: fotos[a.id] ?? null,
      codigo: a.codigo,
    };
  }

  async function abrirPreviewCracha(a: Aluno, guias = mostrarGuias) {
    setQrAluno(a);
    setPreviewUrl(null);
    try {
      const url = await gerarCrachaPreviewImagem(dadosCracha(a), { guias });
      setPreviewUrl(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o crachá");
      setQrAluno(null);
    }
  }

  async function alternarGuias(valor: boolean) {
    setMostrarGuias(valor);
    if (qrAluno) await abrirPreviewCracha(qrAluno, valor);
  }

  async function exportarCrachas(lista: Aluno[], formato: "cartao" | "folha") {
    if (!lista.length) {
      toast.error("Nenhum aluno para gerar crachá");
      return;
    }
    setGerandoCrachas(true);
    const idToast = toast.loading(`Gerando crachás… 0/${lista.length}`);
    try {
      const dados = lista.map(dadosCracha);
      const nome = lista.length === 1 ? `cracha-${lista[0]!.nome.replace(/\s+/g, "-").toLowerCase()}` : "crachas-arena-aquatica";
      // Exportação fiel: mesma renderização (margens e escala) da pré-visualização
      await gerarCrachasPdfFielAoPreview(dados, formato === "folha" ? `${nome}-a4` : nome, {
        formato,
        aoProgredir: (feitos, total) =>
          toast.loading(`Gerando crachás… ${feitos}/${total}`, { id: idToast }),
      });
      toast.success(`${lista.length} crachá(s) gerado(s)`, { id: idToast });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao gerar crachás", { id: idToast });
    } finally {
      setGerandoCrachas(false);
    }

  }

  const CABECALHO_LISTA = ["Código", "Nome", "Idade", "Sexo", "Telefone", "Responsável", "CPF", "RG", "Modalidade", "Turma", "Horário", "PCD", "Situação", "Faltas", "Atestado"];

  function linhasLista(lista: Aluno[]) {
    return lista.map((a) => {
      const turma = turmaDoAluno(a.id);
      const modalidade = matriculaDoAluno(a.id)?.modalidade ?? turma?.modalidade ?? "";
      const atestado = !a.atestado_entregue ? "Não entregue" : atestadoVencido(a.atestado_data) ? "Vencido" : "Em dia";
      return [
        a.codigo,
        a.nome,
        a.idade != null ? String(a.idade) : "",
        a.sexo ?? "",
        a.telefone ?? "",
        a.responsavel ?? "",
        a.cpf ?? "",
        a.rg ?? "",
        modalidade,
        turma?.nome ?? "",
        turma?.horario ?? "",
        a.pcd ? "Sim" : "Não",
        a.ativo ? "Ativo" : "Inativo",
        String(faltasPorAluno[a.id] ?? 0),
        atestado,
      ];
    });
  }

  function exportarListaCsv() {
    if (!permitido("alunos_exportar_lista")) return;
    if (!filtrados.length) return toast.error("Nenhum aluno na lista filtrada");
    const escapar = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [CABECALHO_LISTA, ...linhasLista(filtrados)].map((l) => l.map(escapar).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `alunos-filtrados-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Lista exportada em CSV (${filtrados.length} aluno${filtrados.length > 1 ? "s" : ""})`);
    return;
  }

  async function exportarListaPdf() {
    if (!permitido("alunos_exportar_lista")) return;
    if (!filtrados.length) return toast.error("Nenhum aluno na lista filtrada");
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const larguras = [17, 38, 9, 14, 22, 30, 22, 18, 20, 27, 15, 9, 12, 9, 16];
    let y = 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Lista de alunos — Arena Aquática", 12, 12);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${filtrados.length} aluno(s) · Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 12, 16.5);

    const escreverLinha = (celulas: string[], negrito = false) => {
      doc.setFont("helvetica", negrito ? "bold" : "normal");
      doc.setFontSize(7);
      let x = 12;
      celulas.forEach((c, i) => {
        const largura = larguras[i] ?? 20;
        doc.text(doc.splitTextToSize(c, largura - 2)[0] ?? "", x, y);
        x += largura;
      });
      y += 5;
    };

    y += 6;
    escreverLinha(CABECALHO_LISTA, true);
    doc.setDrawColor(200);
    doc.line(12, y - 3.5, 285, y - 3.5);

    for (const linha of linhasLista(filtrados)) {
      if (y > 198) {
        doc.addPage();
        y = 18;
        escreverLinha(CABECALHO_LISTA, true);
      }
      escreverLinha(linha);
    }

    doc.save(`alunos-filtrados-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success(`Lista exportada em PDF (${filtrados.length} aluno${filtrados.length > 1 ? "s" : ""})`);
    return;
  }

  function turmaDoAlunoPlanilha(id: string): { id: string; nome: string; modalidade: string | null; horario: string | null } | undefined {
    const m = matriculas.find((x) => x.aluno_id === id);
    const t = turmas.find((t) => t.id === (m?.turma_id ?? ""));
    return t ? { id: t.id, nome: t.nome, modalidade: t.modalidade, horario: t.horario } : undefined;
  }

  function modalidadeDoAlunoPlanilha(id: string): string {
    const m = matriculas.find((x) => x.aluno_id === id);
    return m?.modalidade ?? turmaDoAlunoPlanilha(id)?.modalidade ?? "";
  }

  async function exportarPlanilha(): Promise<void> {
    if (!permitido("alunos_exportar_planilha")) return;
    if (!alunos.length) {
      toast.error("Nenhum aluno para exportar");
      return;
    }
    const controle = new AbortController();
    cancelarPlanilhaRef.current = controle;
    setExportandoPlanilha(true);
    setProgressoPlanilha({ etapa: "Preparando planilha...", feitos: 0, total: alunos.length });
    const idToast = toast.loading("Preparando planilha...");
    try {
      const buffer = await montarPlanilhaAlunos({
        alunos: alunos as AlunoPlanilha[],
        turmaDoAluno: turmaDoAlunoPlanilha,
        modalidadeDoAluno: modalidadeDoAlunoPlanilha,
        sinal: controle.signal,
        aoProgredir: (feitos, total) =>
          setProgressoPlanilha({ etapa: "Processando alunos e documentos...", feitos, total }),
        linksDrive: async () => await linksArquivosFn({ data: undefined }),

      });
      const url = URL.createObjectURL(
        new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `alunos-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Planilha exportada em ordem crescente de idade. Os links dos arquivos são temporários (veja a aba \"Sobre os links\").", { id: idToast });
    } catch (err) {
      if (err instanceof ExportacaoCancelada) toast.info("Exportação cancelada", { id: idToast });
      else toast.error(err instanceof Error ? err.message : "Erro ao exportar planilha", { id: idToast });
    } finally {
      cancelarPlanilhaRef.current = null;
      setExportandoPlanilha(false);
      setProgressoPlanilha(null);
    }
  }

  function cancelarExportacaoPlanilha() {
    cancelarPlanilhaRef.current?.abort();
    setProgressoPlanilha((p) => (p ? { ...p, etapa: "Cancelando..." } : p));
  }


  const rotuloHorarios = filtrosHorario.length === 0
    ? "Todos os horários"
    : filtrosHorario.length === 1
      ? filtrosHorario[0]
      : `${filtrosHorario.length} horários selecionados`;

  function alternarHorario(horario: string, marcado: boolean) {
    setFiltrosHorario((atuais) => marcado
      ? [...atuais, horario].filter((item, indice, lista) => lista.indexOf(item) === indice)
      : atuais.filter((item) => item !== horario));
  }

  const filtrados = alunos
    .filter((a) => {
      if (!correspondeBusca(a, busca)) return false;
      if (filtroNotificacao === "ativos" && !a.ativo) return false;
      if (filtroNotificacao === "inativos" && a.ativo) return false;
      if (filtroNotificacao === "em_licenca" && (!a.ativo || !emLicenca.has(a.id))) return false;
      if (filtroNotificacao === "sem_atestado" && a.atestado_entregue) return false;
      if (filtroNotificacao === "atestado_vencido" && !notificarAtestadoVencido(a)) return false;
      if (filtroNotificacao === "atestado_vencer" && !notificarAtestadoVencendo(a, prazoAviso)) return false;
      if (filtroNotificacao === "excesso_faltas" && (!a.ativo || (faltasPorAluno[a.id] ?? 0) < 5)) return false;
      if (filtroSexo !== "todos" && (a.sexo ?? "") !== filtroSexo) return false;
      if (idadeMin && (a.idade ?? -1) < Number(idadeMin)) return false;
      if (idadeMax && (a.idade ?? 999) > Number(idadeMax)) return false;
      const turma = turmaDoAluno(a.id);
      const modalidade = matriculaDoAluno(a.id)?.modalidade ?? turma?.modalidade ?? "";
      if (filtroModalidade !== "todas" && modalidade !== filtroModalidade) return false;
      if (filtrosHorario.length > 0 && !filtrosHorario.includes(turma?.horario ?? "")) return false;
      if (filtroDias !== "todos") {
        const grupo = listaGrupos.find((g) => g.label === filtroDias);
        const diasEsperados = grupo?.dias?.length ? grupo.dias : [];
        const diasTurma = turma?.dias_semana ?? [];
        if (!diasEsperados.length || !diasEsperados.every((d) => diasTurma.includes(d))) return false;
      }
      if (filtroTurno !== "todos" && turnoDoHorario(turma?.horario) !== filtroTurno) return false;
      if (filtroPcd === "todos") return true;
      if (filtroPcd === "sem") return !a.pcd;
      if (filtroPcd === "com") return a.pcd;
      return (a.pcd_condicoes ?? []).includes(filtroPcd);
    })
    .sort((a, b) => {
      const selA = selecionados.includes(a.id) ? 1 : 0;
      const selB = selecionados.includes(b.id) ? 1 : 0;
      if (selA !== selB) return selB - selA;
      return relevanciaBusca(a.nome, busca) - relevanciaBusca(b.nome, busca) || a.nome.localeCompare(b.nome);
    });





  const vencidos = alunos.filter(notificarAtestadoVencido);
  const semAtestado = alunos.filter((a) => !a.atestado_entregue).sort((a, b) => a.nome.localeCompare(b.nome));
  const proximosVencimento = alunos.filter((a) => notificarAtestadoVencendo(a, prazoAviso));
  const excessoFaltas = alunos.filter((a) => a.ativo && (faltasPorAluno[a.id] ?? 0) >= 5);
  const inativos = alunos.filter((a) => !a.ativo).sort((a, b) => a.nome.localeCompare(b.nome));
  const situacao = (a: Aluno): { tom: TomSituacao; rotulo: string } => {
    if (!a.ativo) return { tom: "inativo", rotulo: "Inativo" };
    if (emLicenca.has(a.id)) return { tom: "licenca", rotulo: "Licença médica" };
    if (notificarAtestadoVencido(a)) return { tom: "vencido", rotulo: "Atestado vencido" };
    return { tom: "ativo", rotulo: "Ativo" };
  };
  const totalAtivos = alunos.filter((a) => a.ativo).length;
  const totalLicenca = alunos.filter((a) => a.ativo && emLicenca.has(a.id)).length;
  const resumoSituacoes: { filtro: typeof filtroNotificacao; rotulo: string; tom: TomSituacao; valor: number }[] = [
    { filtro: "ativos", rotulo: "Ativos", tom: "ativo", valor: totalAtivos },
    { filtro: "em_licenca", rotulo: "Em licença", tom: "licenca", valor: totalLicenca },
    { filtro: "atestado_vencido", rotulo: "Atestado vencido", tom: "vencido", valor: vencidos.length },
    { filtro: "inativos", rotulo: "Inativos", tom: "inativo", valor: inativos.length },
  ];
  const qtdFiltrosExtras = [
    filtroPcd !== "todos",
    filtroSexo !== "todos",
    filtroModalidade !== "todas",
    filtrosHorario.length > 0,
    filtroDias !== "todos",
    filtroTurno !== "todos",
    Boolean(idadeMin || idadeMax),
    !["todos", "ativos", "em_licenca", "atestado_vencido", "inativos"].includes(filtroNotificacao),
  ].filter(Boolean).length;
  const percentual = (v: number) => (alunos.length ? `${Math.round((v / alunos.length) * 100)}% do total` : "—");

  const selecionadosAlunos = alunos.filter((a) => selecionados.includes(a.id));
  const todosSelecionados = filtrados.length > 0 && filtrados.every((a) => selecionados.includes(a.id));
  const alternarListaNotificacao = (lista: string) => {
    setListasNotificacoes((atual) => ({ ...atual, [lista]: !atual[lista] }));
  };

  return (
    <AppShell title="Alunos" subtitle="Cadastro e matrículas da Arena Aquática">
      <div className="mb-4 flex justify-end">
        <Button variant="outline" size="sm" disabled={!permitido("alunos_notificacoes")} onClick={() => { if (permitido("alunos_notificacoes")) setMostrarNotificacoes((v) => !v); }}>
          <Bell className="size-4" /> {mostrarNotificacoes ? "Esconder notificações" : "Mostrar notificações"}
          {mostrarNotificacoes ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>
      </div>
      {mostrarNotificacoes && permitido("alunos_notificacoes") ? (
        <>
          <AvisoLicencas onAbrirPerfil={setPerfilLicencaId} />
          <PainelNotificacoes onAbrirPerfil={setPerfilLicencaId} />
        </>
      ) : null}
      <PerfilAluno alunoId={perfilLicencaId} onFechar={() => setPerfilLicencaId(null)} />
      {filtroNotificacao !== "todos" && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm">
          <span className="text-muted-foreground">Filtro ativo:</span>
          <Badge variant="secondary">
            {filtroNotificacao === "ativos" && "Ativos"}
            {filtroNotificacao === "em_licenca" && "Em licença médica"}
            {filtroNotificacao === "inativos" && "Inativos"}
            {filtroNotificacao === "sem_atestado" && "Sem atestado médico"}
            {filtroNotificacao === "atestado_vencido" && "Atestado vencido"}
            {filtroNotificacao === "atestado_vencer" && "Atestado a vencer"}
            {filtroNotificacao === "excesso_faltas" && "Excesso de faltas"}
          </Badge>
          <Button variant="ghost" size="sm" className="ml-auto h-auto px-2 py-1 text-xs" onClick={() => setFiltroNotificacao("todos")}>
            Limpar
          </Button>
        </div>
      )}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden" role="group" aria-label="Situação dos alunos">
        {[{ filtro: "todos" as const, rotulo: "Todos" }, ...resumoSituacoes].map((c) => (
          <button
            key={c.filtro}
            type="button"
            aria-pressed={filtroNotificacao === c.filtro}
            onClick={() => setFiltroNotificacao(c.filtro)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              filtroNotificacao === c.filtro
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-accent",
            )}
          >
            {c.rotulo}
          </button>
        ))}
      </div>
      <div className="mb-5 hidden gap-3 md:grid md:grid-cols-4">
        {resumoSituacoes.map((c) => {
          const ativo = filtroNotificacao === c.filtro;
          return (
            <button
              key={c.filtro}
              type="button"
              aria-pressed={ativo}
              onClick={() => setFiltroNotificacao(ativo ? "todos" : c.filtro)}
              className={cn(
                "rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                ativo ? "border-primary ring-2 ring-primary/30" : "border-border/70",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span className={cn("size-2.5 rounded-full", pontoSituacao(c.tom))} aria-hidden />
                {c.rotulo}
              </span>
              <span className="mt-2 block font-display text-3xl font-semibold text-foreground">{c.valor}</span>
              <span className="text-xs text-muted-foreground">{percentual(c.valor)}</span>
            </button>
          );
        })}
      </div>
      <Button
        type="button"
        variant="outline"
        className="mb-3 min-h-11 w-full justify-between md:hidden"
        aria-expanded={filtrosCelular}
        onClick={() => setFiltrosCelular((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="size-4" />
          {filtrosCelular ? "Esconder filtros" : "Mais filtros"}
          {qtdFiltrosExtras ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{qtdFiltrosExtras}</span>
          ) : null}
        </span>
        {filtrosCelular ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </Button>
      <div className={cn("mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4", !filtrosCelular && "hidden md:grid")}>
        <Select value={filtroNotificacao} onValueChange={(v) => setFiltroNotificacao(v as typeof filtroNotificacao)}>
          <SelectTrigger><SelectValue placeholder="Situação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as situações</SelectItem>
            <SelectItem value="ativos">Ativos</SelectItem>
            <SelectItem value="em_licenca">Em licença médica</SelectItem>
            <SelectItem value="inativos">Inativos</SelectItem>
            <SelectItem value="sem_atestado">Sem atestado médico</SelectItem>
            <SelectItem value="atestado_vencido">Atestado vencido</SelectItem>
            <SelectItem value="atestado_vencer">Atestado a vencer</SelectItem>
            <SelectItem value="excesso_faltas">Excesso de faltas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroPcd} onValueChange={setFiltroPcd}>
          <SelectTrigger><SelectValue placeholder="Filtrar PCD" /></SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value="todos">Todos os alunos</SelectItem>
            <SelectItem value="com">Somente PCD</SelectItem>
            <SelectItem value="sem">Sem PCD</SelectItem>
            <SelectGroup>
              <SelectLabel>Categoria PCD</SelectLabel>
              {CONDICOES_PCD.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select value={filtroModalidade} onValueChange={setFiltroModalidade}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as modalidades</SelectItem>
            <SelectItem value="Natação">Natação</SelectItem>
            <SelectItem value="Hidroginástica">Hidroginástica</SelectItem>
          </SelectContent>
        </Select>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between font-normal"
              aria-label={`Filtrar por horário: ${rotuloHorarios}`}
            >
              <span className="truncate">{rotuloHorarios}</span>
              <ChevronDown className="size-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-80 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto" align="start">
            {listaHorarios.map((horario) => (
              <DropdownMenuCheckboxItem
                key={horario}
                checked={filtrosHorario.includes(horario)}
                onCheckedChange={(marcado) => alternarHorario(horario, marcado === true)}
                onSelect={(evento) => evento.preventDefault()}
              >
                {horario}
              </DropdownMenuCheckboxItem>
            ))}
            {filtrosHorario.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 w-full justify-start"
                onClick={() => setFiltrosHorario([])}
              >
                <X className="size-4" /> Limpar seleção
              </Button>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        <Select value={filtroDias} onValueChange={setFiltroDias}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value="todos">Todos os dias</SelectItem>
            {listaGrupos.map((g) => (
              <SelectItem key={g.id} value={g.label}>{g.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroSexo} onValueChange={setFiltroSexo}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os sexos</SelectItem>
            <SelectItem value="Masculino">Masculino</SelectItem>
            <SelectItem value="Feminino">Feminino</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroTurno} onValueChange={setFiltroTurno}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os turnos</SelectItem>
            {TURNOS.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className={cn("flex items-center gap-2", !filtrosCelular && "hidden md:flex")}>
          <Input className="w-24" type="number" min={0} placeholder="Idade mín." value={idadeMin} onChange={(e) => setIdadeMin(e.target.value)} />
          <span className="text-sm text-muted-foreground">a</span>
          <Input className="w-24" type="number" min={0} placeholder="Idade máx." value={idadeMax} onChange={(e) => setIdadeMax(e.target.value)} />
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome, responsável, CPF, RG ou telefone..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>


        <ImportarAlunos
          podeCriar={permitido("alunos_cadastrar")}
          podeEditar={permitido("alunos_editar")}
          turmas={turmas}
          matriculas={matriculas}
          alunos={alunos as unknown as { id: string; nome: string; cpf: string | null; telefone: string | null }[]}
          onImportado={() => void carregar()}
        />

        <Dialog open={aberto} onOpenChange={setAberto}>
          <DialogTrigger asChild>
            <Button variant="pool" disabled={!permitido("alunos_cadastrar")} onClick={abrirNovo}>
              <Plus className="size-4" /> Nova matrícula
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">{editando ? "Editar aluno" : "Nova matrícula"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={salvar} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome completo</Label>
                <Input
                  required
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: capitalizarNome(e.target.value) })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>RG</Label>
                  <Input value={form.rg} onChange={(e) => setForm({ ...form, rg: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>CPF</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={form.cpf}
                    onChange={(e) => setForm({ ...form, cpf: formatarCPF(e.target.value) })}
                  />
                  {form.cpf && !cpfValido(form.cpf) ? (
                    <p className="flex items-center gap-1 text-xs font-medium text-destructive">
                      <AlertTriangle className="size-3.5" /> CPF inválido
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nascimento</Label>
                  <Input
                    type="date"
                    value={form.data_nascimento}
                    onChange={(e) => {
                      const nasc = e.target.value;
                      const calculada = idadePorNascimento(nasc);
                      setForm((f) => ({ ...f, data_nascimento: nasc, idade: calculada || f.idade }));
                    }}
                  />

                </div>
                <div className="space-y-2">
                  <Label>Celular</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="(00) 00000-0000"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: formatarCelular(e.target.value) })}
                  />
                  <ConversarWhatsApp telefone={form.telefone} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Celular 2</Label>
                  <Input
                    inputMode="numeric"
                    placeholder="(00) 00000-0000"
                    value={form.telefone2}
                    onChange={(e) => setForm({ ...form, telefone2: formatarCelular(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Idade</Label>
                  <Input type="number" min={0} max={120} value={form.idade} onChange={(e) => setForm({ ...form, idade: e.target.value })} />
                  {form.data_nascimento ? (
                    <p className="text-xs text-muted-foreground">Calculada automaticamente pela data de nascimento.</p>
                  ) : null}

                </div>
              </div>
              <div className="space-y-2">
                <Label>Faixa etária</Label>
                <Input readOnly value={faixaEtariaECA(form.data_nascimento, form.idade) || "—"} />
                <p className="text-xs text-muted-foreground">
                  Preenchido automaticamente (ECA): criança até 11 anos, adolescente de 12 a 17, adulto a partir de 18.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Sexo</Label>
                <div className="flex items-center gap-2">
                <Select value={form.sexo} onValueChange={(v) => setForm({ ...form, sexo: v })}>
                  <SelectTrigger aria-label="Sexo" className="min-w-0 flex-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Feminino">Feminino</SelectItem>
                  </SelectContent>
                </Select>
                {form.sexo && (
                  <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label="Limpar sexo" title="Limpar sexo"
                    onClick={() => setForm({ ...form, sexo: "" })}>
                    <X />
                  </Button>
                )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Estuda na rede</Label>
                  <div className="flex items-center gap-2">
                  <Select value={form.rede_ensino} onValueChange={(v) => setForm({ ...form, rede_ensino: v, escola: v === form.rede_ensino ? form.escola : "" })}>
                    <SelectTrigger aria-label="Estuda na rede" className="min-w-0 flex-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pública">Pública</SelectItem>
                      <SelectItem value="Privada">Privada</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.rede_ensino && (
                    <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label="Desmarcar rede de ensino" title="Desmarcar rede de ensino"
                      onClick={() => setForm({ ...form, rede_ensino: "", escola: "" })}>
                      <X />
                    </Button>
                  )}
                  </div>
                </div>
                <div className="min-w-0 space-y-2">
                  <Label>Nome da escola</Label>
                  {escolasDaRede(form.rede_ensino).length > 0 ? (
                    <SelecionarEscola key={form.rede_ensino} rede={form.rede_ensino} value={form.escola} onChange={(escola) => setForm({ ...form, escola })} />
                  ) : (
                    <Input aria-label="Nome da escola" value={form.escola} onChange={(e) => setForm({ ...form, escola: e.target.value })} />
                  )}
                </div>
              </div>
              <div className="space-y-3 rounded-lg border border-border/70 p-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="atestado">Entregou atestado?</Label>
                  <Switch
                    id="atestado"
                    checked={form.atestado_entregue}
                     aria-invalid={Boolean((docs.doc_atestado_path || editando?.doc_atestado_path) && !form.atestado_entregue)}
                    onCheckedChange={(v) => setForm({ ...form, atestado_entregue: v })}
                  />
                </div>
                {form.atestado_entregue ? (
                  <div className="space-y-2">
                    <Label>Data do atestado</Label>
                    <Input
                       id="atestado-data"
                      type="date"
                       aria-invalid={Boolean((docs.doc_atestado_path || editando?.doc_atestado_path) && !form.atestado_data)}
                      value={form.atestado_data}
                      onChange={(e) => setForm({ ...form, atestado_data: e.target.value })}
                    />
                    {atestadoVencido(form.atestado_data) ? (
                      <p className="flex items-center gap-1 text-sm font-medium text-destructive">
                        <AlertTriangle className="size-4" /> Atestado vencido!
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Modalidade</Label>
                <Select value={form.modalidade} onValueChange={(v) => {
                  const selecionada = turmas.find((t) => t.id === turmaId);
                  if (selecionada && (selecionada.modalidade ?? "Natação") !== v) setTurmaId("");
                  setForm({ ...form, modalidade: v });
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione a modalidade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Natação">Natação</SelectItem>
                    <SelectItem value="Hidroginástica">Hidroginástica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">

                <Label>Turma</Label>
                <Select
                  value={turmaId}
                  onValueChange={(v) => {
                    setTurmaId(v);
                    const selecionada = turmas.find((t) => t.id === v);
                    const turno = turnoDoHorario(selecionada?.horario);
                    if (turno) setTurnoForm(turno);
                  }}
                  required={!editando}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      carregando
                        ? "Carregando turmas..."
                        : gruposDeTurmas.length
                          ? "Selecione a turma"
                          : turmas.length
                            ? `Nenhuma turma de ${form.modalidade} disponível`
                            : "Nenhuma turma disponível"
                    } />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {erro ? (
                      <div className="px-3 py-2 text-sm text-destructive">Erro ao carregar turmas</div>
                    ) : turmas.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Nenhuma turma cadastrada</div>
                    ) : gruposDeTurmas.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Nenhuma turma de {form.modalidade} cadastrada</div>
                    ) : (
                      <>
                        <SelectItem value="none" disabled>Selecione uma turma</SelectItem>
                        {gruposDeTurmas.map((g) => (
                          <SelectGroup key={g.label}>
                            <SelectLabel>{g.label}</SelectLabel>
                            {g.turmas.map((t) => (
                              <SelectItem key={t.id} value={t.id} disabled={vagasUsadas(t.id) >= capacidadeTurma(t.id)}>
                                {t.nome.replace(`${g.label} - `, "")} · {vagasUsadas(t.id)}/{capacidadeTurma(t.id)}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Turno</Label>
                <Select
                  value={turnoForm}
                  onValueChange={(v) => {
                    const selecionada = turmas.find((t) => t.id === turmaId);
                    if (selecionada && v !== "todos" && turnoDoHorario(selecionada.horario) !== v) setTurmaId("");
                    setTurnoForm(v);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os turnos</SelectItem>
                    {TURNOS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Selecionado automaticamente pelo horário da turma.</p>
              </div>
              <div className="space-y-3 rounded-lg border border-border/70 p-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pcd">Pessoa com deficiência (PCD)</Label>
                  <Switch id="pcd" checked={form.pcd} onCheckedChange={(v) => setForm({ ...form, pcd: v })} />
                </div>
                {form.pcd ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Condições</Label>
                      {CONDICOES_PCD.map((c) => (
                        <label key={c} className="flex items-start gap-2 text-sm">
                          <Checkbox
                            checked={form.pcd_condicoes.includes(c)}
                            onCheckedChange={(v) =>
                              setForm((f) => ({
                                ...f,
                                pcd_condicoes: v
                                  ? [...f.pcd_condicoes, c]
                                  : f.pcd_condicoes.filter((x) => x !== c),
                              }))
                            }
                          />
                          <span>{c}</span>
                        </label>
                      ))}
                    </div>
                    <Input
                      placeholder="Outras observações sobre a deficiência / apoio"
                      value={form.pcd_descricao}
                      onChange={(e) => setForm({ ...form, pcd_descricao: e.target.value })}
                    />
                  </div>
                ) : null}

              </div>
              <div className="space-y-2">
                <Label>Foto do aluno</Label>
                <div className="flex items-center gap-3">
                  {fotoPreview ? (
                    <img src={fotoPreview} alt="Foto do aluno" className="size-16 rounded-full object-cover" />
                  ) : (
                    <div className="grid size-16 place-items-center rounded-full bg-secondary text-muted-foreground">
                      <ImageIcon className="size-5" />
                    </div>
                  )}
                  <div className="flex flex-1 flex-wrap gap-2">
                    <input
                      id="foto-aluno-arquivo"
                      className="hidden"
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const original = e.target.files?.[0] ?? null;
                        const f = original ? await otimizarImagem(original) : null;
                        setFoto(f);
                        setFotoPreview(f ? URL.createObjectURL(f) : null);
                      }}
                    />
                    <input
                      id="foto-aluno-camera"
                      className="hidden"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={async (e) => {
                        const original = e.target.files?.[0] ?? null;
                        const f = original ? await otimizarImagem(original) : null;
                        setFoto(f);
                        setFotoPreview(f ? URL.createObjectURL(f) : null);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("foto-aluno-arquivo")?.click()}
                    >
                      <Upload className="mr-2 size-4" /> Escolher arquivo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById("foto-aluno-camera")?.click()}
                    >
                      <Camera className="mr-2 size-4" /> Usar câmera
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={!foto && !editando?.foto_path}
                      onClick={() => void excluirFoto()}
                    >
                      <Trash2 className="mr-2 size-4" /> Excluir foto
                    </Button>
                    {foto ? (
                      <span className="w-full truncate text-xs text-muted-foreground">{foto.name}</span>
                    ) : null}
                  </div>

                </div>
              </div>
              <div className="space-y-3 rounded-lg border border-border/70 p-3">
                <Label>Fotos dos documentos</Label>
                {DOCUMENTOS.map((d) => (
                  <div key={d.campo} className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {d.rotulo}
                      {editando?.[d.campo] ? " · já enviado" : ""}
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`doc-${d.campo}`}
                        aria-label={d.rotulo}
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={async (e) => {
                          const original = e.target.files?.[0] ?? null;
                          const arquivo = original ? await otimizarImagem(original) : null;
                          setDocs((s) => ({ ...s, [d.campo]: arquivo }));
                          if (d.campo === "doc_atestado_path" && arquivo) {
                             toast.warning('Preencha "Entregou atestado?" e a data antes de salvar.');
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive"
                        title="Excluir documento"
                        disabled={!docs[d.campo] && !editando?.[d.campo]}
                        onClick={() => void excluirDocumento(d.campo, d.rotulo)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    {d.campo === "doc_ficha_path" && <LeitorFicha
                      key={`${editando?.id ?? "nova"}-${docs.doc_ficha_path?.name ?? "sem-ficha"}-${docs.doc_ficha_path?.lastModified ?? 0}-${docs.doc_ficha_path?.size ?? 0}`}
                      arquivo={docs.doc_ficha_path}
                      editando={Boolean(editando)}
                      permitido={permitido(editando ? "alunos_editar" : "alunos_cadastrar")}
                      onAplicar={(dados) => {
                        if (!permitido(editando ? "alunos_editar" : "alunos_cadastrar")) return;
                        setForm((atual) => ({ ...atual, ...Object.fromEntries(Object.entries(dados).filter(([, v]) => v?.trim())),
                          ...(dados.nome ? { nome: capitalizarNome(dados.nome) } : {}),
                          ...(dados.telefone ? { telefone: formatarCelular(dados.telefone) } : {}),
                          ...(dados.telefone2 ? { telefone2: formatarCelular(dados.telefone2) } : {}),
                          ...(dados.cpf ? { cpf: formatarCPF(dados.cpf) } : {}),
                        }));
                      }}
                    />}
                     {d.campo === "doc_atestado_path" && docs.doc_atestado_path && (!form.atestado_entregue || !form.atestado_data) ? (
                       <p className="flex items-center gap-1 text-xs font-medium text-destructive" role="alert">
                         <AlertTriangle className="size-3.5 shrink-0" /> Marque “Entregou atestado?” e informe a data para salvar.
                       </p>
                     ) : null}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
              </div>
              <Button type="submit" className="w-full" disabled={salvando || carregando || (!editando && !turmaId)}>
                {salvando ? "Salvando..." : "Salvar"}
              </Button>

            </form>
          </DialogContent>
        </Dialog>
      </div>

      {filtrados.length ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-border/70 px-4 py-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={todosSelecionados}
              onCheckedChange={(v) =>
                setSelecionados((s) => {
                  const idsFiltrados = filtrados.map((a) => a.id);
                  if (v) {
                    const conjunto = new Set([...s, ...idsFiltrados]);
                    return Array.from(conjunto);
                  }
                  return s.filter((id) => !idsFiltrados.includes(id));
                })
              }
            />
            Selecionar todos
          </label>
          <span className="text-sm text-muted-foreground">{selecionados.length} selecionado(s)</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!selecionados.length || !permitido("alunos_inativar")} onClick={() => void alternarAtivo(selecionadosAlunos, false)}>
              <UserX className="size-4" /> Inativar
            </Button>
            <Button variant="outline" size="sm" disabled={!selecionados.length || !permitido("alunos_reativar")} onClick={() => void alternarAtivo(selecionadosAlunos, true)}>
              <UserCheck className="size-4" /> Reativar
            </Button>
            <Button variant="destructive" size="sm" disabled={!selecionados.length || !permitido("alunos_excluir")} onClick={() => { if (permitido("alunos_excluir")) setConfirmarExclusao(selecionadosAlunos); }}>
              <Trash2 className="size-4" /> Excluir
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={gerandoCrachas || !filtrados.length}>
                  <IdCard className="size-4" /> {gerandoCrachas ? "Gerando..." : "Crachás"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Exportar crachás CR-80 (PDF)</DropdownMenuLabel>
                <DropdownMenuItem
                  disabled={!selecionados.length}
                  onClick={() => void exportarCrachas(selecionadosAlunos, "cartao")}
                >
                  Selecionados ({selecionados.length}) — 1 por página
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!selecionados.length}
                  onClick={() => void exportarCrachas(selecionadosAlunos, "folha")}
                >
                  Selecionados ({selecionados.length}) — folha A4
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void exportarCrachas(filtrados, "cartao")}>
                  Todos os alunos da lista ({filtrados.length}) — 1 por página
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void exportarCrachas(filtrados, "folha")}>
                  Todos os alunos da lista ({filtrados.length}) — folha A4
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={!filtrados.length || !permitido("alunos_exportar_lista")}>
                  <FileDown className="size-4" /> Exportar lista
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Lista filtrada ({filtrados.length} aluno{filtrados.length !== 1 ? "s" : ""})</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => exportarListaCsv()}>
                  Exportar em CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void exportarListaPdf()}>
                  Exportar em PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              size="sm"
              disabled={exportandoPlanilha || !alunos.length || !permitido("alunos_exportar_planilha")}
              onClick={() => void exportarPlanilha()}
            >
              <FileSpreadsheet className="size-4" /> {exportandoPlanilha ? "Exportando..." : "Exportar planilha"}
            </Button>
            {exportandoPlanilha ? (
              <Button variant="destructive" size="sm" onClick={cancelarExportacaoPlanilha}>
                Cancelar exportação
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {progressoPlanilha ? (
        <Card className="mb-3">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span>{progressoPlanilha.etapa}</span>
              <span className="text-muted-foreground">
                {progressoPlanilha.feitos} de {progressoPlanilha.total}
              </span>
            </div>
            <Progress
              value={
                progressoPlanilha.total > 0
                  ? Math.round((progressoPlanilha.feitos / progressoPlanilha.total) * 100)
                  : 0
              }
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        {filtrados.length ? (
          <div className="hidden grid-cols-[1.25rem_2.75rem_minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,2fr)_10rem_auto] items-center gap-4 border-b border-border/70 bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
            <span />
            <span />
            <span>Nome</span>
            <span>Matrícula</span>
            <span>Turma</span>
            <span>Situação</span>
            <span className="w-[4.5rem]" />
          </div>
        ) : null}
        <ul className="divide-y divide-border/70">
        {filtrados.map((aluno) => {
          const turmasDoAluno = matriculas
            .filter((m) => m.aluno_id === aluno.id)
            .map((m) => turmas.find((t) => t.id === m.turma_id)?.nome)
            .filter(Boolean);
          const sit = situacao(aluno);
          const idade = aluno.idade ?? (idadePorNascimento(aluno.data_nascimento) || null);
          const textoTurmas = turmasDoAluno.length ? turmasDoAluno.join(", ") : "Sem turma";
          return (
            <li
              key={aluno.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 md:grid md:grid-cols-[1.25rem_2.75rem_minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,2fr)_10rem_auto] md:gap-4",
                selecionados.includes(aluno.id) && "bg-secondary/60",
              )}
            >
              <Checkbox
                checked={selecionados.includes(aluno.id)}
                onCheckedChange={(v) =>
                  setSelecionados((s) => (v ? [...s, aluno.id] : s.filter((x) => x !== aluno.id)))
                }
                aria-label={`Selecionar ${aluno.nome}`}
              />
              {fotos[aluno.id] ? (
                <FotoAmpliavel src={fotos[aluno.id]!} nome={aluno.nome} className="size-12 shrink-0 rounded-full object-cover ring-2 ring-border md:size-11" />
              ) : (
                <div className="grid size-12 shrink-0 place-items-center rounded-full bg-pool font-display text-sm font-semibold text-primary-foreground md:size-11">
                  {aluno.nome.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => void abrirDetalhe(aluno)} className="block max-w-full truncate text-left font-semibold text-foreground hover:text-primary hover:underline">
                  {aluno.nome}
                </button>
                <p className="truncate text-xs text-muted-foreground">
                  {[idade ? `${idade} anos` : null, aluno.telefone].filter(Boolean).join(" · ") || "\u00a0"}
                </p>
                <p className="truncate text-xs text-muted-foreground md:hidden">{textoTurmas}</p>
                <p className="text-xs font-medium text-foreground md:hidden">Matrícula {aluno.codigo}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5 md:hidden">
                  <SituacaoAluno tom={sit.tom} rotulo={sit.rotulo} />
                  {aluno.pcd ? <Badge variant="outline">PCD</Badge> : null}
                </div>
              </div>
              <span className="hidden font-mono text-sm text-foreground md:block">{aluno.codigo}</span>
              <span className="hidden min-w-0 text-sm text-primary md:block">
                <span className="line-clamp-2">{textoTurmas}</span>
              </span>
              <div className="hidden flex-wrap gap-1.5 md:flex">
                <SituacaoAluno tom={sit.tom} rotulo={sit.rotulo} />
                {aluno.pcd ? <Badge variant="outline">PCD</Badge> : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon" className="hidden md:inline-flex" aria-label="Editar aluno" title="Editar" disabled={!permitido("alunos_editar")} onClick={() => abrirEdicao(aluno)}><Pencil className="size-4" /></Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-10" aria-label={`Mais ações para ${aluno.nome}`}>
                      <MoreHorizontal className="size-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={() => void abrirDetalhe(aluno)}>Ver ficha do aluno</DropdownMenuItem>
                    <DropdownMenuItem disabled={!permitido("alunos_editar")} onClick={() => abrirEdicao(aluno)}>
                      <Pencil className="size-4" /> Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void abrirPreviewCracha(aluno)}>
                      <IdCard className="size-4" /> Visualizar crachá
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={!permitido(aluno.ativo ? "alunos_inativar" : "alunos_reativar")}
                      onClick={() => void alternarAtivo([aluno], !aluno.ativo)}
                    >
                      {aluno.ativo ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
                      {aluno.ativo ? "Inativar" : "Reativar"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      disabled={!permitido("alunos_excluir")}
                      onClick={() => { if (permitido("alunos_excluir")) setConfirmarExclusao([aluno]); }}
                    >
                      <Trash2 className="size-4" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}
        </ul>
        {!filtrados.length && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {alunos.length ? "Nenhum aluno encontrado com esses filtros." : "Nenhum aluno cadastrado ainda."}
          </p>
        )}
      </div>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{detalhe?.nome}</DialogTitle>
          </DialogHeader>
          {detalhe ? (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                {fotos[detalhe.id] ? (
                  <FotoAmpliavel src={fotos[detalhe.id]!} nome={detalhe.nome} className="size-16 rounded-full object-cover" />
                ) : (
                  <div className="grid size-16 place-items-center rounded-full bg-pool font-display text-primary-foreground">
                    {detalhe.nome.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  <p>
                    Matrícula: <span className="font-medium text-foreground">{detalhe.codigo}</span>
                  </p>
                  <p>{detalhe.telefone ?? "Sem telefone"}</p>
                  <p>{detalhe.email ?? "Sem e-mail"}</p>
                  <p>{detalhe.responsavel ? `Responsável: ${detalhe.responsavel}` : "Sem responsável"}</p>
                  <p>
                    Idade: {detalhe.idade ?? (idadePorNascimento(detalhe.data_nascimento) || "-")}
                    {turmaDoAluno(detalhe.id)?.horario
                      ? ` · Turno: ${turnoDoHorario(turmaDoAluno(detalhe.id)?.horario)}`
                      : ""}
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                disabled={gerandoCrachas}
                onClick={() => void exportarCrachas([detalhe], "cartao")}
              >
                <IdCard className="size-4" /> {gerandoCrachas ? "Gerando..." : "Gerar crachá CR-80 (PDF)"}
              </Button>

              <ConversarWhatsApp telefone={detalhe.telefone} />
              <MensagemWhatsAppIA telefone={detalhe.telefone} />

              <div className="space-y-2 rounded-lg border border-border/70 p-3 text-sm">
                <p className="font-medium">Licença médica</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const id = detalhe.id;
                    setDetalhe(null);
                    setPerfilLicencaId(id);
                  }}
                >
                  Registrar Licença Médica
                </Button>
              </div>

              {detalhe.observacoes ? (
                <div className="rounded-lg border border-border/70 p-3 text-sm">
                  <p className="mb-1 font-medium">Observações</p>
                  <p className="whitespace-pre-wrap text-muted-foreground">{detalhe.observacoes}</p>
                </div>
              ) : null}



              <div className="rounded-lg border border-border/70 p-3 text-sm">
                <p className="mb-1 font-medium">Documentos</p>
                <p className="mb-3 text-muted-foreground">
                  RG: {detalhe.rg ?? "-"} · CPF: {detalhe.cpf ?? "-"}
                </p>
                <div className="mb-3 space-y-2">
                  {DOCUMENTOS.map((d) => {
                    const path = detalhe[d.campo];
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void baixarDoc(d.campo, d.rotulo, path, detalhe.nome)}
                          >
                            Baixar
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <p className="mb-1 font-medium">PCD</p>
                <p className="text-muted-foreground">
                  {detalhe.pcd ? detalhe.pcd_descricao || "Sim" : "Não"}
                </p>
                {detalhe.pcd && (detalhe.pcd_condicoes ?? []).length ? (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted-foreground">
                    {(detalhe.pcd_condicoes ?? []).map((c) => <li key={c}>{c}</li>)}
                  </ul>
                ) : null}
              </div>

              {!detalhe.ativo ? (
                <div className="space-y-1 text-sm">
                  <p className="text-sm font-medium">Inativação</p>
                  <p className="text-muted-foreground">
                    {detalhe.motivo_inativacao ?? "Motivo não informado"}
                  </p>
                  {detalhe.inativado_em ? (
                    <p className="text-xs text-muted-foreground">
                      Inativado em {new Date(detalhe.inativado_em).toLocaleDateString("pt-BR")} às {new Date(detalhe.inativado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {detalhe.inativado_por || detalhe.inativado_por_nome ? ` por ${detalhe.inativado_por_nome ?? nomesUsuarios[detalhe.inativado_por ?? ""] ?? "usuário"}` : ""}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-sm font-medium">Matrículas</p>
                {matriculas.filter((m) => m.aluno_id === detalhe.id).length ? (
                  matriculas
                    .filter((m) => m.aluno_id === detalhe.id)
                    .map((m) => (
                      <div key={m.id} className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                        <p className="font-medium">{turmas.find((t) => t.id === m.turma_id)?.nome ?? "Turma"}</p>
                        <p className="text-xs text-muted-foreground">
                          {m.modalidade} · {m.status}
                          {m.data_inicio ? ` · início ${new Date(`${m.data_inicio}T00:00:00`).toLocaleDateString("pt-BR")}` : ""}
                        </p>
                        {m.created_at ? (
                          <p className="text-xs text-muted-foreground">
                            Matriculado em {new Date(m.created_at).toLocaleDateString("pt-BR")} às {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            {m.registrado_por || m.registrado_por_nome ? ` por ${m.registrado_por_nome ?? nomesUsuarios[m.registrado_por ?? ""] ?? "usuário"}` : ""}
                          </p>
                        ) : null}
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-muted-foreground">Sem matrícula ativa.</p>
                )}
              </div>

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
                            <span className="text-muted-foreground">{ROTULO_STATUS[h.status as keyof typeof ROTULO_STATUS] ?? h.status}</span>
                          </div>
                          {h.observacoes ? <p className="mt-0.5 text-xs text-muted-foreground">Obs.: {h.observacoes}</p> : null}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!qrAluno}
        onOpenChange={(o) => {
          if (!o) {
            setQrAluno(null);
            setPreviewUrl(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Crachá de {qrAluno?.nome}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label htmlFor="guias-cracha" className="text-sm">
                Guias de alinhamento (grade)
              </Label>
              <Switch id="guias-cracha" checked={mostrarGuias} onCheckedChange={(v) => void alternarGuias(v)} />
            </div>
            {previewUrl ? (
              <img alt="Pré-visualização do crachá" src={previewUrl} className="w-full rounded-lg border border-border" />
            ) : (
              <p className="py-12 text-sm text-muted-foreground">Gerando pré-visualização...</p>
            )}

            <Button
              variant="outline"
              disabled={!qrAluno || gerandoCrachas}
              onClick={() => qrAluno && void exportarCrachas([qrAluno], "cartao")}
            >
              <IdCard className="size-4" /> Baixar crachá (PDF)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!confirmarExclusao} onOpenChange={(o) => !o && setConfirmarExclusao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aluno(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmarExclusao?.length === 1
                ? `${confirmarExclusao[0]?.nome} será removido junto com matrículas e histórico de presença.`
                : `${confirmarExclusao?.length ?? 0} alunos serão removidos junto com matrículas e histórico de presença.`}
              {" "}Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={!permitido("alunos_excluir")} onClick={() => void excluirAlunos(confirmarExclusao ?? [])}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!inativando} onOpenChange={(o) => !o && setInativando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Inativar {inativando && inativando.length > 1 ? `${inativando.length} alunos` : "aluno"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {inativando?.length === 1
                ? `${inativando[0]?.nome} será inativado e removido da turma.`
                : `${inativando?.length ?? 0} alunos serão inativados e removidos das turmas.`}
            </p>
            <div className="space-y-1">
              <Label htmlFor="motivo-inativacao">Motivo da inativação *</Label>
              <Textarea
                id="motivo-inativacao"
                value={motivoInativacao}
                onChange={(e) => setMotivoInativacao(e.target.value)}
                placeholder="Ex.: desistência, mudança de cidade, questões de saúde..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setInativando(null)}>Cancelar</Button>
              <Button variant="destructive" disabled={!motivoInativacao.trim() || !permitido("alunos_inativar")} onClick={() => void confirmarInativacao()}>
                <UserX className="size-4" /> Inativar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>


    </AppShell>
  );
}
