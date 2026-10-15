import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function garantirAdmin(context: { supabase: any; userId: string }) {
  const { data: admin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!admin) throw new Error("Apenas administradores podem executar o backup.");
}

/** Executa o backup completo (planilha + fotos/documentos) no Google Drive. Somente administradores. */
export const fazerBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context);
    const { executarBackupCompleto } = await import("@/lib/backup.server");
    return await executarBackupCompleto();
  });

/** Envia a planilha do dia e devolve a fila de fotos/documentos a enviar. */
export const prepararBackupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context);
    try {
      const { prepararBackup } = await import("@/lib/backup.server");
      const resultado = await prepararBackup();
      return { ok: true as const, ...resultado };
    } catch (err) {
      const erro = err instanceof Error ? err.message : "Falha ao preparar o backup.";
      console.error("[backup] prepararBackup falhou:", erro);
      return { ok: false as const, erro, planilha: "", arquivos: [], existentes: {} };
    }
  });

/** Gera a planilha final (com os links do Drive) e envia para a pasta de planilhas. */
export const gerarPlanilhaBackupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context);
    try {
      const { gerarPlanilhaBackupDetalhe } = await import("@/lib/backup.server");
      const d = await gerarPlanilhaBackupDetalhe();
      return { planilha: d.nome, id: d.id, pasta: d.pasta };
    } catch (err) {
      const erro = err instanceof Error ? err.message : "Falha ao gerar a planilha do backup.";
      console.error("[backup] gerarPlanilhaBackup falhou:", erro);
      throw new Error(`Não foi possível gerar a planilha do backup: ${erro}`);
    }
  });

/** Links dos arquivos (fotos e documentos) já enviados ao Google Drive. */
export const linksArquivosDriveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { linksArquivosDrive } = await import("@/lib/backup.server");
    try {
      return await linksArquivosDrive();
    } catch (err) {
      console.error("[backup] não foi possível listar os links do Drive", err);
      return {} as Record<string, string>;
    }
  });


const falhaSchema = z.object({
  caminho: z.string(),
  nome: z.string(),
  pasta: z.string(),
  marcador: z.string(),
  motivo: z.string(),
});

const loteSchema = z.object({
  arquivos: z.array(
    z.object({
      caminho: z.string(),
      nome: z.string(),
      pasta: z.string(),
      marcador: z.string(),
    }),
  ),
  existentes: z.record(z.string(), z.array(z.object({ id: z.string(), name: z.string() }))).optional(),
});

/** Envia um lote de fotos/documentos (usado para exibir progresso na tela). */
export const enviarLoteBackupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => loteSchema.parse(data))
  .handler(async ({ context, data }) => {
    await garantirAdmin(context);
    const { enviarLoteBackup } = await import("@/lib/backup.server");
    return await enviarLoteBackup(data.arquivos, data.existentes);
  });

/** Conta Google (email) onde os backups estão sendo guardados. */
export const contaDriveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context);
    const { contaDrive } = await import("@/lib/backup.server");
    return await contaDrive();
  });

/** Verifica se as pastas do Drive configuradas existem e aceitam novos arquivos. */

export const validarPastasDriveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context);
    const { validarPastasDrive } = await import("@/lib/backup.server");
    return await validarPastasDrive();
  });

/** Registra o resultado do último backup manual. */
export const registrarBackupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        resumo: z.string(),
        status: z.enum(["sucesso", "falha"]).optional(),
        iniciado_em: z.string().optional(),
        planilha_nome: z.string().nullable().optional(),
        planilha_id: z.string().nullable().optional(),
        pasta_planilhas: z.string().nullable().optional(),
        enviados: z.number().int().optional(),
        total: z.number().int().optional(),
        falhas: z.array(falhaSchema).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await garantirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const quando = new Date().toISOString();
    await supabaseAdmin
      .from("backup_cron")
      .update({ ultimo_backup: quando, ultimo_resultado: data.resumo, ultimo_status: data.status ?? "sucesso" })
      .eq("id", true);
    const { registrarHistoricoBackup } = await import("@/lib/backup.server");
    await registrarHistoricoBackup({
      iniciado_em: data.iniciado_em ?? quando,
      origem: "manual",
      status: data.status ?? "sucesso",
      resumo: data.resumo,
      planilha_nome: data.planilha_nome ?? null,
      planilha_id: data.planilha_id ?? null,
      pasta_planilhas: data.pasta_planilhas ?? null,
      enviados: data.enviados ?? 0,
      total: data.total ?? 0,
      falhas: data.falhas ?? [],
      executado_por: context.userId,
    }).catch((e) => console.error("[backup] histórico", e));
    return { ultimo_backup: quando };
  });

/** Lê o estado do backup automático (último resultado + agendamento). Somente administradores. */
export const statusBackupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("backup_cron")
      .select("ultimo_backup,ultimo_resultado,ultimo_status,dia_semana,hora,minuto,ativo")
      .maybeSingle();
    return (data ?? null) as {
      ultimo_backup: string | null;
      ultimo_resultado: string | null;
      ultimo_status: string | null;
      dia_semana: number;
      hora: number;
      minuto: number;
      ativo: boolean;
    } | null;
  });

const agendamentoSchema = z.object({
  dia_semana: z.number().int().min(0).max(6),
  hora: z.number().int().min(0).max(23),
  minuto: z.number().int().min(0).max(59),
  ativo: z.boolean(),
});

/** Salva o dia/horário do backup automático e reprograma o agendador. Somente administradores. */
export const salvarAgendamentoFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => agendamentoSchema.parse(data))
  .handler(async ({ context, data }) => {
    await garantirAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("agendar_backup", {
      _dia: data.dia_semana,
      _hora: data.hora,
      _minuto: data.minuto,
      _ativo: data.ativo,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });


/** Últimas execuções do backup (manual e automático). Somente administradores. */
export const historicoBackupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await garantirAdmin(context);
    const { data, error } = await context.supabase
      .from("backup_historico")
      .select("*")
      .order("iniciado_em", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      id: string;
      iniciado_em: string;
      concluido_em: string | null;
      origem: string;
      status: string;
      resumo: string | null;
      planilha_nome: string | null;
      planilha_id: string | null;
      pasta_planilhas: string | null;
      enviados: number;
      total: number;
      falhas: Array<{ nome: string; motivo: string }>;
      executado_por_nome: string | null;
    }>;
  });

/** Reenvia somente os arquivos que falharam numa execução. Somente administradores. */
export const reenviarFalhasBackupFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await garantirAdmin(context);
    const { reenviarFalhasBackup } = await import("@/lib/backup.server");
    return await reenviarFalhasBackup(data.id);
  });
