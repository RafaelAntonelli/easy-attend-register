export const TURNOS = ["Matutino", "Vespertino", "Noturno"] as const;

export type Turno = (typeof TURNOS)[number];

export function turnoDoHorario(horario: string | null | undefined): Turno | "" {
  const m = (horario ?? "").match(/(\d{1,2})\s*[:h]?/);
  if (!m?.[1]) return "";
  const hora = Number(m[1]);
  if (Number.isNaN(hora)) return "";
  if (hora < 12) return "Matutino";
  if (hora < 18) return "Vespertino";
  return "Noturno";
}

export function idadePorNascimento(data: string | null | undefined) {
  if (!data) return "";
  const nasc = new Date(`${data}T00:00:00`);
  if (Number.isNaN(nasc.getTime())) return "";
  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  if (idade < 0 || idade > 120) return "";
  return String(idade);
}
