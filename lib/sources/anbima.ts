import "server-only";

// Arquivos públicos da ANBIMA (títulos públicos e curva de juros), sem chave.
// O Tesouro Direto passou a responder 403 para o servidor, por isso a troca.

interface PublicBond {
  semiannual: boolean; // paga juros semestrais
  maturity: string;    // "AAAA-MM-DD"
  annualRate: number;  // taxa indicativa % a.a.
}

interface BondSnapshot {
  bonds: PublicBond[];
  referenceDate: string; // "AAAA-MM-DD"
}

export interface YearRate {
  year: number;
  maturity: string;
  annualRate: number;
  // "curva" = estimativa da ETTJ; "projecao" = além dos 10 anos que a ANBIMA publica
  source: "titulo" | "titulo-semestral" | "curva" | "projecao";
}

const toNumber = (s: string) => Number(s.replace(/\./g, "").replace(",", "."));
const toIso = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
const decodeLines = async (res: Response) => new TextDecoder("latin1").decode(await res.arrayBuffer()).split("\n");

// LTN e NTN-F são os prefixados.
function parseBonds(lines: string[]): BondSnapshot {
  const bonds: PublicBond[] = [];
  let referenceDate = "";

  for (const line of lines) {
    // Titulo@DataRef@CodSelic@Emissao@Vencimento@TxCompra@TxVenda@TxIndicativa@...
    const col = line.trim().split("@");
    if (col[0] !== "LTN" && col[0] !== "NTN-F") continue;
    const annualRate = toNumber(col[7]);
    if (!Number.isFinite(annualRate)) continue;
    referenceDate = toIso(col[1]);
    bonds.push({ semiannual: col[0] === "NTN-F", maturity: toIso(col[4]), annualRate });
  }

  bonds.sort((a, b) => a.maturity.localeCompare(b.maturity));
  return { bonds, referenceDate };
}

async function fetchBonds(): Promise<BondSnapshot> {
  // O arquivo do dia só sai à noite e não existe em fim de semana/feriado.
  for (let back = 0; back <= 10; back++) {
    const day = new Date(Date.now() - back * 86_400_000);
    const stamp = day.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).replace(/-/g, "").slice(2);
    const res = await fetch(`https://www.anbima.com.br/informacoes/merc-sec/arqs/ms${stamp}.txt`, { next: { revalidate: 3600 } });
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`ANBIMA: HTTP ${res.status}`);
    const snapshot = parseBonds(await decodeLines(res));
    if (snapshot.bonds.length > 0) return snapshot;
  }
  throw new Error("ANBIMA: nenhum arquivo nos últimos 10 dias");
}

// Parâmetros Svensson dos prefixados: beta1..beta4, lambda1, lambda2.
async function fetchCurveParams(referenceDate: string): Promise<number[]> {
  const res = await fetch("https://www.anbima.com.br/informacoes/est-termo/CZ-down.asp", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ Idioma: "PT", Dt_Ref: referenceDate.split("-").reverse().join("/"), saida: "csv" }).toString(),
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`ANBIMA curva: HTTP ${res.status}`);
  const line = (await decodeLines(res)).find((l) => l.startsWith("PREFIXADOS;"));
  const params = line?.trim().split(";").slice(1, 7).map(toNumber) ?? [];
  if (params.length !== 6 || !params.every(Number.isFinite)) throw new Error("ANBIMA curva: formato inesperado");
  return params;
}

function curveRate([b1, b2, b3, b4, l1, l2]: number[], years: number): number {
  const slope = (l: number) => (1 - Math.exp(-l * years)) / (l * years);
  const hump = (l: number) => slope(l) - Math.exp(-l * years);
  return (b1 + b2 * slope(l1) + b3 * hump(l1) + b4 * hump(l2)) * 100;
}

export async function fetchPrefixedByYear(from = 2029, to = 2040) {
  const { bonds, referenceDate } = await fetchBonds();
  // Se a curva falhar, ainda mostra os anos que têm título.
  const params = await fetchCurveParams(referenceDate).catch(() => null);
  const years: YearRate[] = [];

  for (let year = from; year <= to; year++) {
    const ofYear = bonds.filter((b) => b.maturity.startsWith(`${year}-`));
    const bond = ofYear.find((b) => !b.semiannual) ?? ofYear[0];
    if (bond) {
      const source = bond.semiannual ? "titulo-semestral" : "titulo";
      years.push({ year, maturity: bond.maturity, annualRate: bond.annualRate, source });
    } else if (params) {
      const maturity = `${year}-01-01`;
      const term = (Date.parse(maturity) - Date.parse(referenceDate)) / (365.25 * 86_400_000);
      years.push({ year, maturity, annualRate: curveRate(params, term), source: term <= 10 ? "curva" : "projecao" });
    }
  }

  return { years, referenceDate };
}
