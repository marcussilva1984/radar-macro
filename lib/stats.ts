// Estatística simples reusada em vários lugares: surpresa (z-score) e correlação de Pearson.

export function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stddev(values: number[]): number {
  const m = mean(values);
  const variance = mean(values.map((v) => (v - m) ** 2));
  return Math.sqrt(variance);
}

// z-score de um valor novo contra a distribuição histórica (janela anterior, sem incluir o próprio valor).
export function zScore(value: number, history: number[]): number | null {
  if (history.length < 10) return null; // amostra curta demais pra ser confiável
  const sd = stddev(history);
  if (sd === 0) return null;
  return (value - mean(history)) / sd;
}

export function pearsonCorrelation(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length < 5) return null;
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    const xa = a[i] - ma;
    const xb = b[i] - mb;
    num += xa * xb;
    da += xa * xa;
    db += xb * xb;
  }
  const denom = Math.sqrt(da * db);
  if (denom === 0) return null;
  return num / denom;
}
