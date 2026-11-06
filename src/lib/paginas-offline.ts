/** Keep every saved enrollment, even beyond the server's per-request row limit. */
export async function consultarPaginas<T>(consulta: (inicio: number, fim: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const data: T[] = [];
  for (let inicio = 0; ; inicio += 500) {
    const pagina = await consulta(inicio, inicio + 499);
    if (pagina.error) return { data: null, error: pagina.error };
    data.push(...(pagina.data ?? []));
    if ((pagina.data?.length ?? 0) < 500) return { data, error: null };
  }
}