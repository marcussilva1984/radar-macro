import "server-only";

// API pública do Tesouro Direto — sem chave, atualizada durante horário de mercado.
const URL = "https://www.tesourodireto.com.br/json/br/com/b3/tesourodireto/component/page/prices/allPrices.json";

export interface TesouroBond {
  name: string;         // ex: "Tesouro Prefixado 2032"
  type: "Prefixado" | "IPCA+" | "Selic" | "Outro";
  maturity: string;     // "AAAA-MM-DD"
  annualRate: number;   // taxa ao ano em % (yield de compra)
  minAmount: number;    // aporte mínimo em R$
  unitPrice: number;    // preço unitário atual
  updatedAt: string;    // horário da última atualização
}

interface RawBond {
  TrsrBd: {
    nm: string;
    mtrtyDt: string;
    anulInvstmtRate: number;
    minInvstmtAmt: number;
    untrInvstmtVal: number;
    featrs?: string;
    invstmtStbl?: { nm?: string };
    UpdDate?: string;
    UpdTime?: string;
  };
}

function classifyType(name: string): TesouroBond["type"] {
  const n = name.toLowerCase();
  if (n.includes("ipca")) return "IPCA+";
  if (n.includes("prefixado")) return "Prefixado";
  if (n.includes("selic")) return "Selic";
  return "Outro";
}

export async function fetchTesouroBonds(): Promise<TesouroBond[]> {
  const res = await fetch(URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; radar-macro/0.1)" },
    next: { revalidate: 1800 }, // cache 30 min
  });
  if (!res.ok) throw new Error(`Tesouro Direto: HTTP ${res.status}`);

  const data = await res.json() as { response: { TrsrBdTradgList: RawBond[] } };
  const list = data?.response?.TrsrBdTradgList ?? [];

  return list
    .map((item): TesouroBond => {
      const b = item.TrsrBd;
      return {
        name: b.nm,
        type: classifyType(b.nm),
        maturity: b.mtrtyDt?.split("T")[0] ?? "",
        annualRate: b.anulInvstmtRate ?? 0,
        minAmount: b.minInvstmtAmt ?? 0,
        unitPrice: b.untrInvstmtVal ?? 0,
        updatedAt: b.UpdDate ? `${b.UpdDate} ${b.UpdTime ?? ""}`.trim() : "",
      };
    })
    .filter((b) => b.annualRate > 0)
    .sort((a, b) => a.maturity.localeCompare(b.maturity));
}
