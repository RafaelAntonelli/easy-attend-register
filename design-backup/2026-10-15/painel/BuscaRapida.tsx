import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { normalizarTexto } from "@/lib/formatacao";

type Aluno = { id: string; nome: string; codigo: string; ativo: boolean; cpf: string | null };

/** Busca de alunos por nome, código de matrícula ou CPF, abrindo o perfil. */
export function BuscaRapida({ onAbrirPerfil }: { onAbrirPerfil: (id: string) => void }) {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    void supabase
      .from("alunos")
      .select("id,nome,codigo,ativo,cpf")
      .order("nome")
      .then(({ data }) => setAlunos((data ?? []) as Aluno[]));
  }, []);

  const resultados = useMemo(() => {
    const termo = normalizarTexto(busca).trim();
    if (termo.length < 2) return [];
    const digitos = busca.replace(/\D/g, "");
    return alunos
      .filter((a) => {
        if (a.codigo.toLowerCase() === termo.replace(/\s/g, "")) return true;
        if (digitos.length >= 4 && (a.cpf ?? "").replace(/\D/g, "").includes(digitos)) return true;
        const nome = normalizarTexto(a.nome);
        return termo.split(/\s+/).every((p) => nome.includes(p)) || a.codigo.toLowerCase().includes(termo);
      })
      .sort((a, b) => Number(b.ativo) - Number(a.ativo))
      .slice(0, 8);
  }, [alunos, busca]);

  return (
    <div className="relative mb-6">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar aluno por nome, código de matrícula ou CPF..."
        className="h-12 pl-10 text-base"
        aria-label="Buscar aluno"
      />
      {busca.trim().length >= 2 ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
          {resultados.map((a) => (
            <button
              key={a.id}
              type="button"
              className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-secondary"
              onClick={() => {
                onAbrirPerfil(a.id);
                setBusca("");
              }}
            >
              <span className="truncate font-medium">{a.nome}</span>
              <span className="flex shrink-0 items-center gap-2">
                {!a.ativo ? <Badge variant="outline">Inativo</Badge> : null}
                <span className="font-mono text-xs text-muted-foreground">{a.codigo}</span>
              </span>
            </button>
          ))}
          {!resultados.length ? <p className="px-4 py-3 text-sm text-muted-foreground">Nenhum aluno encontrado.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
