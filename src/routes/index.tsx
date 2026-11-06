import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { PerfilAluno } from "@/components/PerfilAluno";
import { AulasDoDia } from "@/components/painel/AulasDoDia";
import { PainelLicencas } from "@/components/painel/PainelLicencas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  component: Painel,
  head: () => ({
    meta: [
      { title: "Arena Aquática | Matrículas e presença" },
      {
        name: "description",
        content: "Sistema da Arena Aquática para matricular alunos, organizar turmas e registrar presença por QR Code.",
      },
      { property: "og:title", content: "Arena Aquática | Matrículas e presença" },
      { property: "og:description", content: "Matrículas, turmas e presença por QR Code em um só painel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Painel() {
  const { isAdmin } = useAuth();
  const [perfilId, setPerfilId] = useState<string | null>(null);
  return (
    <AppShell title="Painel" subtitle={new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}>
      <Card className="overflow-hidden border-none bg-pool text-primary-foreground shadow-pool">
        <CardContent className="space-y-4 py-8">
          <h2 className="font-display text-2xl font-semibold">Comece a aula</h2>
          <p className="text-sm text-primary-foreground/80">
            Abra o leitor de QR Code e registre a entrada dos alunos na borda da piscina, pelo celular ou pelo computador.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link to="/presenca">Registrar presença</Link>
            </Button>
            {/* Professores não veem o atalho de matrícula no Painel. */}
            {isAdmin ? (
              <Button asChild variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                <Link to="/alunos" search={{ nova: true }}>Nova matrícula</Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>


      <div className="mt-6 grid min-w-0 gap-6 [&>*]:min-w-0">
        <AulasDoDia />
        <PainelLicencas onAbrirPerfil={setPerfilId} />
      </div>
      <PerfilAluno alunoId={perfilId} onFechar={() => setPerfilId(null)} />

    </AppShell>
  );
}
