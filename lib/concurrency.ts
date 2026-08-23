// mapa com concorrência limitada — evita 1 request-por-vez (lento, estoura timeout de function)
// e evita disparar todas de uma vez (rate limit da API). Usado na ingestão do YouTube, que pode
// ter dezenas/centenas de canais inscritos.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
