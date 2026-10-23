/**
 * Data escolhida na tela de Presença.
 * Fica só na memória do app aberto: ao abrir o aplicativo de novo, volta para o dia atual.
 * Trocar de tela mantém a data escolhida, mas só no mesmo dia (se virar o dia, volta para hoje).
 */
export type DataPresencaSessao = { data: string; escolhidaEm: string };

let sessao: DataPresencaSessao | null = null;

export function chaveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dataInicialPresenca(salva: DataPresencaSessao | null, agora: Date): string {
  if (salva && salva.escolhidaEm === chaveDia(agora)) return salva.data;
  return chaveDia(agora);
}

export function lembrarDataPresenca(data: string, agora: Date = new Date()): void {
  sessao = { data, escolhidaEm: chaveDia(agora) };
}

export function lerDataPresenca(agora: Date = new Date()): string {
  return dataInicialPresenca(sessao, agora);
}
