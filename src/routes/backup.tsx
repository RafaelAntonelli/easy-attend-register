import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CloudUpload, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { fazerBackup } from "@/lib/backup.functions";

export const Route = createFileRoute("/backup")({
  component: BackupPage,
  head: () => ({
    meta: [
      { title: "Backup no Google Drive | Arena Aquática" },
      {
        name: "description",
        content: "Envie a planilha de alunos e os documentos para o Google Drive. Acesso restrito a administradores.",
      },
      { property: "og:title", content: "Backup no Google Drive | Arena Aquática" },
      { property: "og:description", content: "Backup manual e automático dos dados da Arena Aquática." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function BackupPage() {
  const { isAdmin } = useAuth();
  const [backupando, setBackupando] = useState(false);
  const [ultimo, setUltimo] = useState<{ ultimo_backup: string | null; ultimo_resultado: string | null } | null>(null);
  const executarBackup = useServerFn(fazerBackup);

  useEffect(() => {
    if (!isAdmin) return;
    void supabase
      .from("backup_cron")
      .select("ultimo_backup,ultimo_resultado")
      .maybeSingle()
      .then(({ data }) => setUltimo(data ?? null));
  }, [isAdmin]);

  async function backupAgora() {
    setBackupando(true);
    const idToast = toast.loading("Enviando backup para o Google Drive…");
    try {
      const r = await executarBackup();
      toast.success(
        `Backup concluído: ${r.planilha} e ${r.imagens} imagem(ns)${r.falhas.length ? ` · ${r.falhas.length} falha(s)` : ""}`,
        { id: idToast },
      );
      setUltimo({ ultimo_backup: new Date().toISOString(), ultimo_resultado: `${r.planilha} · ${r.imagens} imagem(ns)` });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha no backup", { id: idToast });
    } finally {
      setBackupando(false);
    }
  }

  if (!isAdmin) {
    return (
      <AppShell title="Backup" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
            <ShieldAlert className="size-5 text-destructive" />
            Somente administradores podem acessar e executar o backup.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Backup" subtitle="Envio da planilha e dos documentos para o Google Drive">
      <Card className="max-w-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-display text-base">
            <CloudUpload className="size-4" /> Backup no Google Drive
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O backup envia a planilha de alunos do dia e todas as fotos e documentos para as pastas configuradas no
            Google Drive. Ele também roda automaticamente toda segunda-feira.
          </p>
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p>
              <span className="text-muted-foreground">Último backup: </span>
              {ultimo?.ultimo_backup ? new Date(ultimo.ultimo_backup).toLocaleString("pt-BR") : "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Resultado: </span>
              {ultimo?.ultimo_resultado ?? "—"}
            </p>
          </div>
          <Button disabled={backupando} onClick={() => void backupAgora()}>
            <CloudUpload className="size-4" /> {backupando ? "Enviando..." : "Fazer Backup"}
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
