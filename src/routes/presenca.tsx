import { useAuth } from "@/lib/auth";
import { useMinhasTurmas } from "@/lib/permissoes";
import { FotoAmpliavel } from "@/components/FotoAmpliavel";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Search, X, CalendarIcon, ChevronDown, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { BotoesChamada, ProgressoChamada } from "@/components/BotoesChamada";
import { PerfilAluno } from "@/components/PerfilAluno";
import { AnotacaoAula } from "@/components/AnotacaoAula";
import { dataBR, licencaEmVigor, type Licenca } from "@/lib/licenca";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { FAIXAS_ETARIAS, faixaEtariaECA, TURNOS, turnoDoHorario, type FaixaEtaria } from "@/lib/turnos";
import { enfileirar, estaOnline, lerCache, salvarCache } from "@/lib/offline";
import { correspondeBusca, relevanciaBusca } from "@/lib/formatacao";
import { useGruposDias } from "@/lib/dias";



export const Route = createFileRoute("/presenca")({
  component: PresencaPage,
  head: () => ({
    meta: [
      { title: "Registro de presença | Arena Aquática" },
      { name: "description", content: "Registre a presença dos alunos por leitura de QR Code ou pela lista da turma." },
      { property: "og:title", content: "Registro de presença | Arena Aquática" },
      { property: "og:description", content: "Presença por QR Code na Arena Aquática." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Turma = { id: string; nome: string; horario: string | null; modalidade: string; dias_semana: string[] | null };
type Aluno = {
  id: string;
  nome: string;
  codigo: string;
  foto_path: string | null;
  data_nascimento: string | null;
  idade: number | null;
};

/** Iniciais do aluno (primeira e última letra do nome) para quando não há foto. */
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? "?";
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return (primeira + ultima).toUpperCase();
}

function rotuloTurma(turma: Turma, nome = turma.nome) {
  if (!turma.horario || nome.includes(turma.horario)) return nome;
  return `${nome} · ${turma.horario}`;
}

type StatusPresenca = "presente" | "falta" | "falta_justificada";

const rotuloStatus: Record<StatusPresenca, string> = {
  presente: "Presente",
  falta: "Falta",
  falta_justificada: "Falta justificada",
};

const GRUPOS_DIAS = [
  { rotulo: "Terça e Quinta", prefixo: "terça e quinta", remover: "Terça e Quinta - " },
  { rotulo: "Terça e Quinta", prefixo: "terca e quinta", remover: "Terca e Quinta - " },
  { rotulo: "Quarta e Sexta", prefixo: "quarta e sexta", remover: "Quarta e Sexta - " },
];

const CHAVE_FILTROS_PRESENCA = "arena-aquatica:filtros-presenca";

type FiltrosPresencaSalvos = {
  data: string;
  turno: string;
  modalidade: string;
  dias: string;
  faixasEtarias: FaixaEtaria[];
  turmaIds: string[];
};

function lerFiltrosPresenca(): Partial<FiltrosPresencaSalvos> | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const valor = JSON.parse(localStorage.getItem(CHAVE_FILTROS_PRESENCA) ?? "null") as unknown;
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
    const filtros = valor as Record<string, unknown>;
    const resultado: Partial<FiltrosPresencaSalvos> = {};
    if (typeof filtros["data"] === "string") resultado.data = filtros["data"];
    if (typeof filtros["turno"] === "string") resultado.turno = filtros["turno"];
    if (typeof filtros["modalidade"] === "string") resultado.modalidade = filtros["modalidade"];
    if (typeof filtros["dias"] === "string") resultado.dias = filtros["dias"];
    if (Array.isArray(filtros["faixasEtarias"])) {
      resultado.faixasEtarias = filtros["faixasEtarias"].filter(
        (faixa): faixa is FaixaEtaria => FAIXAS_ETARIAS.includes(faixa as FaixaEtaria),
      );
    }
    if (Array.isArray(filtros["turmaIds"])) {
      resultado.turmaIds = filtros["turmaIds"].filter((id): id is string => typeof id === "string");
    }
    return resultado;
  } catch {
    return null;
  }
}

function PresencaPage() {
  const { lista: listaGrupos } = useGruposDias();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const { user: usuarioAtual } = useAuth();
  const minhasTurmas = useMinhasTurmas(usuarioAtual?.id);
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [matriculas, setMatriculas] = useState<{ aluno_id: string; turma_id: string }[]>([]);
  const [turmaIds, setTurmaIds] = useState<string[]>([]);
  const [filtroModalidade, setFiltroModalidade] = useState("todas");
  const [filtroTurno, setFiltroTurno] = useState("todos");
  const [filtroDias, setFiltroDias] = useState("todos");
  const [filtrosFaixaEtaria, setFiltrosFaixaEtaria] = useState<FaixaEtaria[]>([]);
  const [scanning, setScanning] = useState(false);
  const [busca, setBusca] = useState("");
  const [statusPorAluno, setStatusPorAluno] = useState<Record<string, StatusPresenca>>({});
  const [observacao, setObservacao] = useState("");
  const [registros, setRegistros] = useState<{ nome: string; hora: string; status: StatusPresenca; obs: string | null }[]>([]);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const lastRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const [confirmacao, setConfirmacao] = useState<{ aluno: Aluno; jaRegistrado: StatusPresenca | null } | null>(null);
  const [perfilAlunoId, setPerfilAlunoId] = useState<string | null>(null);
  const statusRef = useRef<Record<string, StatusPresenca>>({});
  const filtrosRestauradosRef = useRef(false);
  const ignorarPrimeiraPersistenciaRef = useRef(true);
  statusRef.current = statusPorAluno;



  const [data, setData] = useState<Date>(new Date());
  const hoje = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;

  useEffect(() => {
    const filtros = lerFiltrosPresenca();
    if (filtros?.data) {
      const dataSalva = new Date(`${filtros.data}T12:00:00`);
      if (!Number.isNaN(dataSalva.getTime())) setData(dataSalva);
    }
    if (filtros?.turno) setFiltroTurno(filtros.turno);
    if (filtros?.modalidade) setFiltroModalidade(filtros.modalidade);
    if (filtros?.dias) setFiltroDias(filtros.dias);
    if (filtros?.faixasEtarias) setFiltrosFaixaEtaria(filtros.faixasEtarias);
    if (filtros?.turmaIds) setTurmaIds(filtros.turmaIds);
    filtrosRestauradosRef.current = true;
  }, []);

  useEffect(() => {
    if (!filtrosRestauradosRef.current || typeof localStorage === "undefined") return;
    if (ignorarPrimeiraPersistenciaRef.current) {
      ignorarPrimeiraPersistenciaRef.current = false;
      return;
    }
    const filtros: FiltrosPresencaSalvos = {
      data: hoje,
      turno: filtroTurno,
      modalidade: filtroModalidade,
      dias: filtroDias,
      faixasEtarias: filtrosFaixaEtaria,
      turmaIds,
    };
    localStorage.setItem(CHAVE_FILTROS_PRESENCA, JSON.stringify(filtros));
  }, [filtroDias, filtroModalidade, filtrosFaixaEtaria, filtroTurno, hoje, turmaIds]);

  useEffect(() => {
    void (async () => {
      if (!estaOnline()) {
        const c = await lerCache<{ turmas: Turma[]; alunos: Aluno[]; matriculas: { aluno_id: string; turma_id: string }[] }>("presenca");
        if (c) {
          setTurmas(c.turmas ?? []);
          setAlunos(c.alunos ?? []);
          setMatriculas(c.matriculas ?? []);
        }
        return;
      }
      const [t, a, m] = await Promise.all([
        supabase.from("turmas").select("id,nome,horario,modalidade,dias_semana").order("nome"),
        supabase.from("alunos").select("id,nome,codigo,foto_path,data_nascimento,idade").eq("ativo", true).order("nome"),
        supabase.from("matriculas").select("aluno_id,turma_id").eq("status", "ativa"),
      ]);
      if (t.data) setTurmas(t.data as Turma[]);
      const listaAlunos = (a.data ?? []) as Aluno[];
      if (a.data) setAlunos(listaAlunos);
      if (m.data) setMatriculas(m.data as { aluno_id: string; turma_id: string }[]);
      void salvarCache("presenca", { turmas: t.data ?? [], alunos: a.data ?? [], matriculas: m.data ?? [] });
      const comFoto = listaAlunos.filter((x) => x.foto_path);
      if (comFoto.length) {
        const { data: signed } = await supabase.storage
          .from("fotos-alunos")
          .createSignedUrls(comFoto.map((x) => x.foto_path as string), 3600);
        const mapa: Record<string, string> = {};
        comFoto.forEach((x, i) => {
          const url = signed?.[i]?.signedUrl;
          if (url) mapa[x.id] = url;
        });
        setFotos(mapa);
      }
    })();
  }, []);


  async function carregarPresencasDoDia() {
    if (!estaOnline()) return;
    const { data } = await supabase
      .from("presencas")
      .select("aluno_id,horario,status,observacoes,alunos(nome)")
      .eq("data", hoje)
      .order("horario", { ascending: false });
    if (!data) return;
    const mapa: Record<string, StatusPresenca> = {};
    data.forEach((r) => {
      mapa[r.aluno_id as string] = (r.status as StatusPresenca) ?? "presente";
    });
    setStatusPorAluno(mapa);
    setRegistros(
      data.map((r) => ({
        nome: (r.alunos as { nome: string } | null)?.nome ?? "Aluno",
        hora: new Date(r.horario as string).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        status: (r.status as StatusPresenca) ?? "presente",
        obs: (r.observacoes as string | null) ?? null,
      })),
    );
  }

  useEffect(() => {
    void carregarPresencasDoDia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoje]);

  const [licencas, setLicencas] = useState<Licenca[]>([]);
  useEffect(() => {
    void supabase
      .from("licencas_medicas")
      .select("id,aluno_id,data_inicio,data_retorno,motivo,encerrada_em")
      .is("encerrada_em", null)
      .then(({ data }) => setLicencas((data ?? []) as Licenca[]));
  }, []);

  async function registrar(
    aluno: Aluno,
    metodo: "qrcode" | "manual",
    status: StatusPresenca = "presente",
    opcoes: { emLote?: boolean } = {},
  ): Promise<boolean> {
    const licenca = licencas.find((l) => l.aluno_id === aluno.id && licencaEmVigor(l, hoje));
    if (licenca && status === "falta") status = "falta_justificada";
    const obs = !opcoes.emLote && observacao.trim()
      ? observacao.trim()
      : licenca && status === "falta_justificada"
        ? `Licença médica até ${dataBR(licenca.data_retorno)}`
        : null;
    const agoraIso = new Date().toISOString();
    const turmasSelecionadasOrdenadas = turmasVisiveis.filter((turma) => turmaIdsValidos.includes(turma.id));
    const turmaIdRegistro = turmasSelecionadasOrdenadas.find((turma) =>
      matriculas.some((matricula) => matricula.aluno_id === aluno.id && matricula.turma_id === turma.id),
    )?.id ?? null;

    if (!estaOnline()) {
      await enfileirar({
        tipo: "presenca",
        aluno_id: aluno.id,
        turma_id: turmaIdRegistro,
        data: hoje,
        status,
        metodo,
        observacoes: obs,
        horario: agoraIso,
      });
      setStatusPorAluno((s) => ({ ...s, [aluno.id]: status }));
      setRegistros((r) => [
        { nome: aluno.nome, hora: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), status, obs },
        ...r.filter((x) => x.nome !== aluno.nome),
      ]);
      if (!opcoes.emLote) {
        setObservacao("");
        toast.success(`${rotuloStatus[status]}: ${aluno.nome} (salvo offline)`);
      }
      return true;
    }

    const existente = await supabase
      .from("presencas")
      .select("id")
      .eq("aluno_id", aluno.id)
      .eq("data", hoje)
      .maybeSingle();

    if (existente.data) {
      const { error } = await supabase
        .from("presencas")
        .update({ status, metodo, turma_id: turmaIdRegistro, horario: agoraIso, observacoes: obs })
        .eq("id", existente.data.id);
      if (error) {
        toast.error(error.message);
        return false;
      }
    } else {
      const { error } = await supabase.from("presencas").insert({
        aluno_id: aluno.id,
        turma_id: turmaIdRegistro,
        data: hoje,
        metodo,
        status,
        observacoes: obs,
      });
      if (error) {
        toast.error(error.message);
        return false;
      }
    }
    if (opcoes.emLote) return true;
    toast.success(`${rotuloStatus[status]}: ${aluno.nome}`);
    setObservacao("");
    void carregarPresencasDoDia();
    return true;
  }

  const [confirmarTodos, setConfirmarTodos] = useState(false);
  const [marcandoTodos, setMarcandoTodos] = useState(false);

  /** Marca presença, um por vez, para quem ainda não tem registro e não está de licença. */
  async function marcarTodosPresentes(alvos: Aluno[]) {
    setMarcandoTodos(true);
    let feitos = 0;
    for (const aluno of alvos) {
      const ok = await registrar(aluno, "manual", "presente", { emLote: true });
      if (!ok) break;
      feitos++;
    }
    setMarcandoTodos(false);
    if (feitos) toast.success(`${feitos} aluno${feitos === 1 ? "" : "s"} marcado${feitos === 1 ? "" : "s"} como presente${feitos === 1 ? "" : "s"}`);
    void carregarPresencasDoDia();
  }


  async function desfazerRegistro(aluno: Aluno) {
    if (!estaOnline()) {
      await enfileirar({ tipo: "presenca_remover", aluno_id: aluno.id, data: hoje });
      setStatusPorAluno((s) => {
        const novo = { ...s };
        delete novo[aluno.id];
        return novo;
      });
      setRegistros((r) => r.filter((x) => x.nome !== aluno.nome));
      toast.success(`Registro removido: ${aluno.nome} (salvo offline)`);
      return;
    }
    const existente = await supabase
      .from("presencas")
      .select("id")
      .eq("aluno_id", aluno.id)
      .eq("data", hoje)
      .maybeSingle();
    if (existente.data) {
      const { error } = await supabase.from("presencas").delete().eq("id", existente.data.id);
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    toast.success(`Registro removido: ${aluno.nome}`);
    void carregarPresencasDoDia();
  }

  function onScan(texto: string) {
    const agora = Date.now();
    
    if (lastRef.current.code === texto && agora - lastRef.current.at < 4000) return;
    lastRef.current = { code: texto, at: agora };
    const aluno = alunos.find((a) => a.codigo === texto.trim());
    if (!aluno) {
      toast.error("QR Code não reconhecido.");
      return;
    }
    setConfirmacao((atual) => atual ?? { aluno, jaRegistrado: statusRef.current[aluno.id] ?? null });
  }


  async function iniciarScanner() {
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("leitor-qr");
      scannerRef.current = scanner as unknown as { stop: () => Promise<void>; clear: () => void };
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (texto) => void onScan(texto),
        () => {},
      );
      setScanning(true);
    } catch {
      toast.error("Não foi possível acessar a câmera.");
    }
  }

  async function pararScanner() {
    try {
      await scannerRef.current?.stop();
      scannerRef.current?.clear();
    } catch {
      /* ignora */
    }
    scannerRef.current = null;
    setScanning(false);
  }

  useEffect(() => {
    return () => {
      void scannerRef.current?.stop().catch(() => {});
    };
  }, []);

  const turmasDoAluno = (id: string) => {
    const ids = new Set(matriculas.filter((matricula) => matricula.aluno_id === id).map((matricula) => matricula.turma_id));
    return turmas.filter((turma) => ids.has(turma.id));
  };

  function alternarFaixaEtaria(faixa: FaixaEtaria, marcada: boolean) {
    setFiltrosFaixaEtaria((atuais) =>
      marcada ? [...atuais, faixa] : atuais.filter((item) => item !== faixa),
    );
  }

  function alternarTurma(id: string, marcada: boolean) {
    setTurmaIds((atuais) => marcada ? [...atuais, id] : atuais.filter((turmaId) => turmaId !== id));
  }

  const rotuloFaixas = filtrosFaixaEtaria.length === 0
    ? "Todas as faixas etárias"
    : filtrosFaixaEtaria.length === 1
      ? filtrosFaixaEtaria[0]
      : `${filtrosFaixaEtaria.length} faixas selecionadas`;

  const turmasVisiveis = turmas.filter(
    (t) => {
      if (filtroModalidade !== "todas" && t.modalidade !== filtroModalidade) return false;
      if (filtroTurno !== "todos" && turnoDoHorario(t.horario) !== filtroTurno) return false;
      if (filtroDias !== "todos") {
        const grupo = listaGrupos.find((g) => g.label === filtroDias);
        const diasEsperados = grupo?.dias?.length ? grupo.dias : [];
        const diasTurma = t.dias_semana ?? [];
        if (!diasEsperados.length || !diasEsperados.every((d) => diasTurma.includes(d))) return false;
      }
      return true;
    },
  ).sort((a, b) => (minhasTurmas.has(a.id) ? 0 : 1) - (minhasTurmas.has(b.id) ? 0 : 1));
  const turmasVisiveisIds = new Set(turmasVisiveis.map((turma) => turma.id));
  const turmaIdsValidos = turmaIds.filter((id) => turmasVisiveisIds.has(id));
  const rotuloTurmas = turmaIdsValidos.length === 0
    ? "Todas as turmas"
    : turmaIdsValidos.length === 1
      ? turmas.find((turma) => turma.id === turmaIdsValidos[0])?.nome ?? "1 turma selecionada"
      : `${turmaIdsValidos.length} turmas selecionadas`;

  const filtrados = alunos
    .filter((a) => {
      if (!correspondeBusca(a, busca)) return false;
      const turmasAluno = turmasDoAluno(a.id);
      const turmasSelecionadas = turmaIdsValidos.length > 0
        ? turmasAluno.filter((turma) => turmaIdsValidos.includes(turma.id))
        : turmasAluno;
      if (turmaIdsValidos.length > 0 && turmasSelecionadas.length === 0) return false;
      if (filtroModalidade !== "todas" && !turmasSelecionadas.some((turma) => turma.modalidade === filtroModalidade)) return false;
      if (filtroTurno !== "todos" && !turmasSelecionadas.some((turma) => turnoDoHorario(turma.horario) === filtroTurno)) return false;
      if (filtrosFaixaEtaria.length > 0) {
        const faixa = faixaEtariaECA(a.data_nascimento, a.idade);
        if (!faixa || !filtrosFaixaEtaria.includes(faixa)) return false;
      }
      if (filtroDias !== "todos") {
        const grupo = listaGrupos.find((g) => g.label === filtroDias);
        const diasEsperados = grupo?.dias?.length ? grupo.dias : [];
        if (!diasEsperados.length || !turmasSelecionadas.some((turma) => {
          const diasTurma = turma.dias_semana ?? [];
          return diasEsperados.every((dia) => diasTurma.includes(dia));
        })) return false;
      }
      return true;
    })
    .sort((a, b) => relevanciaBusca(a.nome, busca) - relevanciaBusca(b.nome, busca) || a.nome.localeCompare(b.nome));
  const semRegistro = filtrados.filter(
    (a) => !statusPorAluno[a.id] && !licencas.some((l) => l.aluno_id === a.id && licencaEmVigor(l, hoje)),
  );
  return (
    <AppShell title="Presença" subtitle={`Registros de ${data.toLocaleDateString("pt-BR")}`}>
      <div className="mb-6 grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="space-y-2">

          <Label>Data do registro</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="size-4" />
                {format(data, "PPP", { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                locale={ptBR}
                selected={data}
                onSelect={(d) => d && setData(d)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Turno</Label>
          <Select
            value={filtroTurno}
            onValueChange={(v) => {
              setFiltroTurno(v);
               setTurmaIds((atuais) => atuais.filter((id) => {
                 const turma = turmas.find((item) => item.id === id);
                 return Boolean(turma && (v === "todos" || turnoDoHorario(turma.horario) === v));
               }));
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
        </div>
        <div className="space-y-2">

          <Label>Modalidade</Label>
          <Select
            value={filtroModalidade}
            onValueChange={(v) => {
              setFiltroModalidade(v);
               setTurmaIds((atuais) => atuais.filter((id) => {
                 const turma = turmas.find((item) => item.id === id);
                 return Boolean(turma && (v === "todas" || turma.modalidade === v));
               }));
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as modalidades</SelectItem>
              <SelectItem value="Natação">Natação</SelectItem>
              <SelectItem value="Hidroginástica">Hidroginástica</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Dias</Label>
          <Select
            value={filtroDias}
            onValueChange={(v) => {
              setFiltroDias(v);
               const grupo = listaGrupos.find((item) => item.label === v);
               const diasEsperados = grupo?.dias ?? [];
               setTurmaIds((atuais) => atuais.filter((id) => {
                 const turma = turmas.find((item) => item.id === id);
                 return Boolean(turma && (v === "todos" || diasEsperados.every((dia) => (turma.dias_semana ?? []).includes(dia))));
               }));
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="todos">Todos os dias</SelectItem>
              {listaGrupos.map((g) => (
                <SelectItem key={g.id} value={g.label}>{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Faixa etária</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between font-normal"
                aria-label={`Filtrar por faixa etária: ${rotuloFaixas}`}
              >
                <span className="truncate">{rotuloFaixas}</span>
                <ChevronDown className="size-4 shrink-0 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]" align="start">
              {FAIXAS_ETARIAS.map((faixa) => (
                <DropdownMenuCheckboxItem
                  key={faixa}
                  checked={filtrosFaixaEtaria.includes(faixa)}
                  onCheckedChange={(marcada) => alternarFaixaEtaria(faixa, marcada === true)}
                  onSelect={(evento) => evento.preventDefault()}
                >
                  {faixa}
                </DropdownMenuCheckboxItem>
              ))}
              {filtrosFaixaEtaria.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 w-full justify-start"
                  onClick={() => setFiltrosFaixaEtaria([])}
                >
                  <X className="size-4" /> Limpar seleção
                </Button>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="space-y-2">
          <Label>Turma da aula</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between font-normal"
                aria-label={`Filtrar por turma da aula: ${rotuloTurmas}`}
              >
                <span className="truncate">{rotuloTurmas}</span>
                <ChevronDown className="size-4 shrink-0 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-80 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto" align="start">
              {GRUPOS_DIAS.map((g) => {
                const doGrupo = turmasVisiveis.filter((t) => t.nome.toLowerCase().startsWith(g.prefixo));
                if (!doGrupo.length) return null;
                return (
                  <div key={`${g.prefixo}-${g.rotulo}`}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{g.rotulo}</div>
                    {doGrupo.map((t) => (
                      <DropdownMenuCheckboxItem
                        key={t.id}
                        checked={turmaIdsValidos.includes(t.id)}
                        onCheckedChange={(marcada) => alternarTurma(t.id, marcada === true)}
                        onSelect={(evento) => evento.preventDefault()}
                      >
                         {rotuloTurma(t, t.nome.replace(g.remover, ""))}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </div>
                );
              })}
              {turmasVisiveis.filter((t) => !GRUPOS_DIAS.some((g) => t.nome.toLowerCase().startsWith(g.prefixo))).map((t) => (
                <DropdownMenuCheckboxItem
                  key={t.id}
                  checked={turmaIdsValidos.includes(t.id)}
                  onCheckedChange={(marcada) => alternarTurma(t.id, marcada === true)}
                  onSelect={(evento) => evento.preventDefault()}
                >
                   {rotuloTurma(t)}
                </DropdownMenuCheckboxItem>
              ))}
              {turmaIdsValidos.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-1 w-full justify-start"
                  onClick={() => setTurmaIds([])}
                >
                  <X className="size-4" /> Limpar seleção
                </Button>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>


      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Tabs defaultValue="qr">
          <TabsList>
            <TabsTrigger value="qr">QR Code</TabsTrigger>
            <TabsTrigger value="lista">Lista manual</TabsTrigger>
          </TabsList>

          <TabsContent value="qr" className="pt-4">
            <Card className="border-border/70">
              <CardContent className="space-y-4 pt-6">
                <div id="leitor-qr" className="overflow-hidden rounded-xl bg-secondary [&_video]:w-full" />
                {!scanning ? (
                  <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    Aponte a câmera para o QR Code da carteirinha do aluno.
                  </div>
                ) : null}
                {scanning ? (
                  <Button variant="outline" className="w-full" onClick={() => void pararScanner()}>
                    <CameraOff className="size-4" /> Parar leitura
                  </Button>
                ) : (
                  <Button className="w-full" onClick={() => void iniciarScanner()}>
                    <Camera className="size-4" /> Iniciar leitura
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lista" className="pt-4">
            <Card className="border-border/70">
              <CardContent className="space-y-3 pt-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Buscar por nome, CPF ou telefone..." value={busca} onChange={(e) => setBusca(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Observações (justificativa)</Label>
                  <Textarea
                    rows={2}
                    placeholder="Ex.: apresentou atestado médico"
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">O texto é salvo no histórico do aluno junto com o registro.</p>
                </div>
                <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-3">
                  <ProgressoChamada marcados={filtrados.filter((a) => statusPorAluno[a.id]).length} total={filtrados.length} />
                  {turmaIdsValidos.length > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 w-full border-primary/50 text-primary hover:bg-primary/10 hover:text-primary"
                      disabled={marcandoTodos || !semRegistro.length}
                      onClick={() => setConfirmarTodos(true)}
                    >
                      <Users className="size-4" />
                      {marcandoTodos ? "Marcando..." : semRegistro.length ? `Marcar todos como presentes (${semRegistro.length})` : "Todos já foram marcados"}
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">Escolha a turma da aula para marcar todos como presentes de uma vez.</p>
                  )}
                </div>
                <div className="max-h-[36rem] space-y-3 overflow-y-auto pr-1">
                  {filtrados.map((a) => {
                    const atual = statusPorAluno[a.id];
                    return (
                      <div key={a.id} className="flex min-h-20 flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-3">
                        <div className="flex min-w-40 flex-1 items-center gap-3">
                          {fotos[a.id] ? (
                            <FotoAmpliavel src={fotos[a.id]!} nome={a.nome} className="size-16 rounded-full border border-border object-cover" />
                          ) : (
                            <span className="flex size-16 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-sm font-semibold text-muted-foreground">
                              {iniciais(a.nome)}
                            </span>
                          )}
                          <div className="min-w-0">
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto max-w-full justify-start p-0 text-left font-medium"
                              onClick={() => setPerfilAlunoId(a.id)}
                              title={`Ver perfil de ${a.nome}`}
                            >
                              <span className="truncate">{a.nome}</span>
                            </Button>
                            {(() => {
                              const lic = licencas.find((l) => l.aluno_id === a.id && licencaEmVigor(l, hoje));
                              return lic ? (
                                <p className="text-xs font-medium text-primary">Licença médica até {dataBR(lic.data_retorno)}</p>
                              ) : null;
                            })()}
                            {atual ? <p className="text-xs text-muted-foreground">{rotuloStatus[atual]}</p> : null}
                          </div>
                        </div>
                        <BotoesChamada
                          nome={a.nome}
                          atual={atual}
                          onEscolher={(st) => void (atual === st ? desfazerRegistro(a) : registrar(a, "manual", st))}
                        />
                      </div>
                    );
                  })}
                  {!filtrados.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum aluno encontrado.</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="space-y-6">
        <AnotacaoAula
          turmas={turmasVisiveis.filter((t) => turmaIdsValidos.includes(t.id)).map((t) => ({ id: t.id, nome: rotuloTurma(t) }))}
          data={hoje}
        />
        <Card className="border-border/70">
          <CardHeader><CardTitle className="font-display text-lg">Registros do dia ({registros.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-[42rem] space-y-2 overflow-y-auto pr-1">
              {registros.map((r, i) => (
              <div key={i} className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>{r.nome}</span>
                  <span className="text-muted-foreground">{rotuloStatus[r.status]} · {r.hora}</span>
                </div>
                {r.obs ? <p className="mt-0.5 text-xs text-muted-foreground">Obs.: {r.obs}</p> : null}
              </div>
              ))}
              {!registros.length && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum registro nesta data.</p>}
            </div>
          </CardContent>
        </Card>
        </div>
      </div>

      <PerfilAluno alunoId={perfilAlunoId} onFechar={() => setPerfilAlunoId(null)} />

      <AlertDialog open={confirmarTodos} onOpenChange={setConfirmarTodos}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar todos como presentes?</AlertDialogTitle>
            <AlertDialogDescription>
              {semRegistro.length} aluno{semRegistro.length === 1 ? "" : "s"} sem registro em{" "}
              {format(data, "dd/MM/yyyy", { locale: ptBR })} será{semRegistro.length === 1 ? "" : "ão"} marcado
              {semRegistro.length === 1 ? "" : "s"} como presente{semRegistro.length === 1 ? "" : "s"}. Quem está de licença
              médica ou já foi marcado não muda. Depois, é só tocar em Falta para quem não veio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const alvos = semRegistro;
                setConfirmarTodos(false);
                void marcarTodosPresentes(alvos);
              }}
            >
              Marcar presentes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(confirmacao)} onOpenChange={(aberto) => !aberto && setConfirmacao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmacao?.jaRegistrado ? "Presença já registrada hoje" : "Confirmar presença?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmacao?.jaRegistrado ? (
                <>
                  <strong>{confirmacao.aluno.nome}</strong> já tem registro de{" "}
                  {rotuloStatus[confirmacao.jaRegistrado].toLowerCase()} em{" "}
                  {format(data, "dd/MM/yyyy", { locale: ptBR })}. Deseja registrar novamente (o registro anterior será
                  substituído)?
                </>
              ) : (
                <>
                  Registrar presença de <strong>{confirmacao?.aluno.nome}</strong> em{" "}
                  {format(data, "dd/MM/yyyy", { locale: ptBR })}?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                lastRef.current = { code: "", at: 0 };
                setConfirmacao(null);
              }}
            >
              Não
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const alvo = confirmacao;
                setConfirmacao(null);
                if (alvo) void registrar(alvo.aluno, "qrcode");
              }}
            >
              {confirmacao?.jaRegistrado ? "Registrar mesmo assim" : "Sim"}
            </AlertDialogAction>
          </AlertDialogFooter>

        </AlertDialogContent>
      </AlertDialog>
    </AppShell>

  );
}
