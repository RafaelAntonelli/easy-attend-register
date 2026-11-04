import { useRef, useState, type ReactNode } from "react";
import { Camera, ImagePlus, Lock, UserRound, Phone, GraduationCap, HeartPulse, Waves } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { obterPerfilPortal, salvarFotoPortal } from "@/lib/portal-extras.functions";
import { tokenAparelhoLocal } from "@/lib/aparelho-local";
import { otimizarImagem } from "@/lib/imagem";
import { portalAlunoConsulta } from "@/lib/portal-aluno-consulta";
import { vencimentoAtestado, atestadoVencido } from "@/lib/atestado";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const perfilPortalConsulta = queryOptions({ queryKey: ["perfil-portal"], queryFn: () => obterPerfilPortal({ data: { aparelho: tokenAparelhoLocal() } }) });

const dataBr = (v: string | null | undefined) => (v ? v.slice(0, 10).split("-").reverse().join("/") : null);
function idade(nascimento: string | null) {
  if (!nascimento) return null;
  const [a, m, d] = nascimento.slice(0, 10).split("-").map(Number);
  const hoje = new Date();
  let anos = hoje.getFullYear() - a;
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) anos--;
  return anos >= 0 ? anos : null;
}

function Bloco({ titulo, icone, children }: { titulo: string; icone: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-border pt-5">
      <h3 className="mb-4 flex items-center gap-2 font-display text-base font-semibold">{icone}{titulo}</h3>
      <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{children}</dl>
    </section>
  );
}
function Campo({ rotulo, valor, largo }: { rotulo: string; valor: ReactNode; largo?: boolean }) {
  const vazio = valor === null || valor === undefined || valor === "";
  return (
    <div className={largo ? "sm:col-span-2" : undefined}>
      <dt className="text-sm text-muted-foreground">{rotulo}</dt>
      <dd className={vazio ? "text-sm text-muted-foreground" : "break-words font-medium"}>{vazio ? "Não informado" : valor}</dd>
    </div>
  );
}

export function PerfilPortalAluno() {
  const { data: perfil } = useSuspenseQuery(perfilPortalConsulta);
  const { data: portal } = useSuspenseQuery(portalAlunoConsulta);
  const qc = useQueryClient();
  const foto = useServerFn(salvarFotoPortal);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null), galeriaRef = useRef<HTMLInputElement>(null);

  async function enviarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget, original = input.files?.[0];
    if (!original) return;
    const file = await otimizarImagem(original);
    if (file.size > 5 * 1024 * 1024) { toast.error("Use uma foto de até 5 MB."); input.value = ""; return; }
    const tipo = file.type;
    if (tipo !== "image/jpeg" && tipo !== "image/png" && tipo !== "image/webp") { toast.error("Use uma foto JPG, PNG ou WebP."); input.value = ""; return; }
    setBusy(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(",")[1] ?? ""); r.onerror = () => reject(new Error("Não foi possível ler a foto.")); r.readAsDataURL(file); });
      await foto({ data: { aparelho: tokenAparelhoLocal(), foto: { tipo, base64 } } });
      await Promise.all([qc.invalidateQueries({ queryKey: ["portal-aluno"] }), qc.invalidateQueries({ queryKey: ["perfil-portal"] }), qc.invalidateQueries({ queryKey: ["alunos"] })]);
      toast.success("Foto atualizada no cadastro.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao enviar foto."); } finally { setBusy(false); input.value = ""; }
  }

  const anos = idade(perfil.data_nascimento);
  const validade = vencimentoAtestado(perfil.atestado_data);
  const atestado = !perfil.atestado_entregue ? "Não entregue" : !validade ? "Entregue (data não informada)" : atestadoVencido(perfil.atestado_data) ? `Vencido em ${validade.toLocaleDateString("pt-BR")}` : `Válido até ${validade.toLocaleDateString("pt-BR")}`;
  const iniciais = perfil.nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();

  return (
    <section className="max-w-3xl space-y-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
          {portal.fotoUrl ? <img src={portal.fotoUrl} alt={`Foto de ${perfil.nome}`} className="h-full w-full object-cover" /> : <span className="font-display text-3xl font-semibold text-muted-foreground">{iniciais}</span>}
        </div>
        <div className="min-w-0 space-y-2">
          <h2 className="font-display text-2xl font-semibold break-words">{perfil.nome}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">{perfil.codigo}</span>
            <Badge variant={perfil.ativo ? "secondary" : "destructive"} className="rounded-md">{perfil.ativo ? "Ativo" : "Inativo"}</Badge>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" size="sm" disabled={busy} onClick={() => cameraRef.current?.click()}><Camera className="mr-2 size-4" />Tirar foto</Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => galeriaRef.current?.click()}><ImagePlus className="mr-2 size-4" />Escolher foto</Button>
          </div>
          <input ref={cameraRef} id="foto-camera-portal" className="hidden" aria-label="Foto pela câmera" type="file" accept="image/jpeg,image/png,image/webp" capture="user" disabled={busy} onChange={enviarFoto} />
          <input ref={galeriaRef} id="foto-portal" className="hidden" aria-label="Foto da galeria" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={enviarFoto} />
          {busy && <p role="status" className="text-sm text-muted-foreground">Salvando foto…</p>}
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" />
        Estes são os dados do seu cadastro. Para corrigir alguma informação, procure a equipe da Arena.
      </p>

      <Bloco titulo="Dados pessoais" icone={<UserRound className="size-5 text-primary" />}>
        <Campo rotulo="Nome completo" valor={perfil.nome} largo />
        <Campo rotulo="Data de nascimento" valor={perfil.data_nascimento ? `${dataBr(perfil.data_nascimento)}${anos !== null ? ` (${anos} anos)` : ""}` : null} />
        <Campo rotulo="Sexo" valor={perfil.sexo} />
        <Campo rotulo="Faixa etária" valor={perfil.faixa_etaria} />
        <Campo rotulo="CPF" valor={perfil.cpf} />
        <Campo rotulo="RG" valor={perfil.rg} />
        <Campo rotulo="Matrícula" valor={<span className="font-mono">{perfil.codigo}</span>} />
        <Campo rotulo="Cadastrado em" valor={dataBr(perfil.cadastrado_em)} />
      </Bloco>

      <Bloco titulo="Contato" icone={<Phone className="size-5 text-primary" />}>
        <Campo rotulo="Responsável" valor={perfil.responsavel} largo />
        <Campo rotulo="Telefone" valor={perfil.telefone} />
        <Campo rotulo="Outro telefone" valor={perfil.telefone2} />
        <Campo rotulo="E-mail" valor={perfil.email} largo />
      </Bloco>

      <Bloco titulo="Escola" icone={<GraduationCap className="size-5 text-primary" />}>
        <Campo rotulo="Rede de ensino" valor={perfil.rede_ensino} />
        <Campo rotulo="Escola" valor={perfil.escola} />
      </Bloco>

      <Bloco titulo="Saúde" icone={<HeartPulse className="size-5 text-primary" />}>
        <Campo rotulo="Atestado médico" valor={atestado} />
        <Campo rotulo="Pessoa com deficiência (PCD)" valor={perfil.pcd ? "Sim" : "Não"} />
        {perfil.pcd && <Campo rotulo="Condições" valor={perfil.pcd_condicoes.join(", ")} largo />}
        {perfil.pcd && <Campo rotulo="Descrição" valor={perfil.pcd_descricao} largo />}
      </Bloco>

      <section className="border-t border-border pt-5">
        <h3 className="mb-4 flex items-center gap-2 font-display text-base font-semibold"><Waves className="size-5 text-primary" />Minhas turmas</h3>
        {portal.turmas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma turma ativa no momento.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {portal.turmas.map(t => (
              <li key={t.id} className="rounded-md border border-border p-3">
                <p className="font-medium">{t.modalidade}</p>
                <p className="text-sm text-muted-foreground">{t.nome}</p>
                <p className="mt-1 text-sm">{[t.horario, t.dias_semana.join(", ")].filter(Boolean).join(" · ") || "Horário não informado"}</p>
                {t.professor && <p className="text-sm text-muted-foreground">Professor(a): {t.professor}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
