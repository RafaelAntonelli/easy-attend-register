import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";

type Grupo<T> = { nome: string; total: number; alunos: T[] };

function linhasDoGrupo(nome: string) {
  return nome.split(" · ").flatMap((parte) => {
    const linhas: string[] = [];
    let linha = "";
    for (const palavra of parte.split(" ")) {
      if (linha && `${linha} ${palavra}`.length > 32) {
        linhas.push(linha);
        linha = palavra;
      } else linha = linha ? `${linha} ${palavra}` : palavra;
    }
    if (linha) linhas.push(linha);
    return linhas;
  });
}

export function GraficoAlunos<T>({ pontos, total, onSelecionar }: {
  pontos: Grupo<T>[];
  total: number;
  onSelecionar: (grupo: Grupo<T>) => void;
}) {
  const alturaLinha = Math.max(72, ...pontos.map((ponto) => linhasDoGrupo(ponto.nome).length * 16 + 28));
  const percentual = (valor: number) => `${(total ? valor / total * 100 : 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return <>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-chart-1" />Quantidade de alunos por grupo</span>
      <span>Do maior para o menor</span>
    </div>
    <div className="max-h-[36rem] overflow-auto rounded-md border border-border">
      <div className="min-w-[620px] p-3">
        <ResponsiveContainer width="100%" height={pontos.length * alturaLinha + 56}>
          <BarChart data={pontos} layout="vertical" margin={{ left: 0, right: 52, top: 8, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
            <XAxis type="number" allowDecimals={false} fontSize={12} stroke="var(--muted-foreground)" axisLine={false} tickLine={false}
              label={{ value: "Quantidade de alunos", position: "insideBottom", offset: -18, fill: "var(--muted-foreground)", fontSize: 12 }} />
            <YAxis type="category" dataKey="nome" width={235} axisLine={false} tickLine={false}
              tick={({ x, y, payload }) => {
                const linhas = linhasDoGrupo(String(payload.value));
                return <text x={Number(x) - 10} y={Number(y) - (linhas.length - 1) * 8} textAnchor="end" fill="var(--foreground)" fontSize={11}>
                  {linhas.map((linha, index) => <tspan key={index} x={Number(x) - 10} dy={index ? 16 : 0}>{linha}</tspan>)}
                </text>;
              }} />
            <Tooltip cursor={{ fill: "var(--muted)" }} content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const quantidade = Number(payload[0]?.value ?? 0);
              return <div className="max-w-80 space-y-2 whitespace-normal break-words rounded-md border border-border bg-popover p-3 text-sm text-popover-foreground shadow-md">
                <p className="font-medium">{label}</p>
                <p><span className="font-semibold tabular-nums">{quantidade}</span> alunos · {percentual(quantidade)} do total filtrado</p>
              </div>;
            }} />
            <Bar dataKey="total" name="Alunos" maxBarSize={28} radius={[0, 4, 4, 0]} fill="var(--chart-1)" cursor="pointer" isAnimationActive={false}
              onClick={(valor: unknown) => {
                const dado = valor as { payload?: Grupo<T> };
                if (dado.payload) onSelecionar(dado.payload);
              }}>
              <LabelList dataKey="total" position="right" fill="var(--foreground)" fontSize={13} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-background"><tr className="border-b border-border">
          <th scope="col" className="py-3 text-left font-medium">Grupo de alunos</th>
          <th scope="col" className="px-3 py-3 text-right font-medium">Alunos</th>
          <th scope="col" className="py-3 text-right font-medium">% do total</th>
        </tr></thead>
        <tbody>{pontos.map((ponto) => <tr key={ponto.nome} className="border-b border-border last:border-0">
          <td className="py-3 pr-3"><Button variant="link" className="h-auto max-w-full justify-start whitespace-normal break-words p-0 text-left" onClick={() => onSelecionar(ponto)}>{ponto.nome}</Button></td>
          <td className="px-3 py-3 text-right font-semibold tabular-nums">{ponto.total}</td>
          <td className="py-3 text-right tabular-nums text-muted-foreground">{percentual(ponto.total)}</td>
        </tr>)}</tbody>
        <tfoot><tr className="border-t border-border font-semibold"><td className="py-3">Total filtrado</td><td className="px-3 py-3 text-right tabular-nums">{total}</td><td className="py-3 text-right tabular-nums">{percentual(total)}</td></tr></tfoot>
      </table>
    </div>
  </>;
}