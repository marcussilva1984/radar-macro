import "server-only";

export interface FearGreed {
  value: number; // 0-100
  classification: string; // "Extreme Fear" | "Fear" | "Neutral" | "Greed" | "Extreme Greed"
  timestamp: Date;
}

// Índice de Medo e Ganância de cripto (alternative.me, público, sem chave, atualiza 1x/dia).
export async function getFearGreedIndex(): Promise<FearGreed | null> {
  try {
    // Atualiza só 1x/dia na fonte — 5 min de cache aqui já evita bater à toa a cada navegação.
    const res = await fetch("https://api.alternative.me/fng/?limit=1", { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.data?.[0];
    if (!item) return null;
    return {
      value: Number(item.value),
      classification: item.value_classification,
      timestamp: new Date(Number(item.timestamp) * 1000),
    };
  } catch {
    return null;
  }
}
