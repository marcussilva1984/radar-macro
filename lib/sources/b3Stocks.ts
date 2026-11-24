// Lista de ações B3 rastreadas — símbolo Yahoo (.SA), setor e DY estimado dos últimos 12m.
// DY e ex-date são aproximados e atualizados manualmente (mesma convenção das taxas de juros).
export interface B3Stock {
  symbol: string;   // ex: "PETR4"
  yahoo: string;    // ex: "PETR4.SA"
  name: string;
  sector: string;
  dividendYield12m: number; // % ao ano, estimativa
  exMonth?: number; // mês habitual do ex-dividendo (1-12), undefined = irregular
}

export const B3_STOCKS: B3Stock[] = [
  // Petróleo & Gás
  { symbol: "PETR4", yahoo: "PETR4.SA", name: "Petrobras PN", sector: "Petróleo & Gás", dividendYield12m: 14 },
  { symbol: "PRIO3", yahoo: "PRIO3.SA", name: "PRIO", sector: "Petróleo & Gás", dividendYield12m: 3 },
  // Mineração & Siderurgia
  { symbol: "VALE3", yahoo: "VALE3.SA", name: "Vale", sector: "Mineração", dividendYield12m: 10 },
  { symbol: "CSNA3", yahoo: "CSNA3.SA", name: "CSN", sector: "Mineração", dividendYield12m: 5 },
  { symbol: "GGBR4", yahoo: "GGBR4.SA", name: "Gerdau PN", sector: "Mineração", dividendYield12m: 8 },
  // Bancos
  { symbol: "ITUB4", yahoo: "ITUB4.SA", name: "Itaú Unibanco", sector: "Bancos", dividendYield12m: 8 },
  { symbol: "BBDC4", yahoo: "BBDC4.SA", name: "Bradesco PN", sector: "Bancos", dividendYield12m: 7 },
  { symbol: "BBAS3", yahoo: "BBAS3.SA", name: "Banco do Brasil", sector: "Bancos", dividendYield12m: 10 },
  { symbol: "SANB11", yahoo: "SANB11.SA", name: "Santander BR", sector: "Bancos", dividendYield12m: 9 },
  // Consumo & Varejo
  { symbol: "ABEV3", yahoo: "ABEV3.SA", name: "Ambev", sector: "Consumo", dividendYield12m: 6 },
  { symbol: "LREN3", yahoo: "LREN3.SA", name: "Lojas Renner", sector: "Varejo", dividendYield12m: 3 },
  { symbol: "MGLU3", yahoo: "MGLU3.SA", name: "Magazine Luiza", sector: "Varejo", dividendYield12m: 1 },
  { symbol: "VVAR3", yahoo: "VVAR3.SA", name: "Americanas", sector: "Varejo", dividendYield12m: 0 },
  // Energia Elétrica
  { symbol: "ELET3", yahoo: "ELET3.SA", name: "Eletrobras ON", sector: "Energia Elétrica", dividendYield12m: 4 },
  { symbol: "TAEE11", yahoo: "TAEE11.SA", name: "Taesa", sector: "Energia Elétrica", dividendYield12m: 10 },
  { symbol: "ENGI11", yahoo: "ENGI11.SA", name: "Energisa", sector: "Energia Elétrica", dividendYield12m: 5 },
  { symbol: "EGIE3", yahoo: "EGIE3.SA", name: "Engie Brasil", sector: "Energia Elétrica", dividendYield12m: 7 },
  // Saúde
  { symbol: "RADL3", yahoo: "RADL3.SA", name: "Raia Drogasil", sector: "Saúde", dividendYield12m: 2 },
  { symbol: "HAPV3", yahoo: "HAPV3.SA", name: "Hapvida", sector: "Saúde", dividendYield12m: 1 },
  // Indústria
  { symbol: "WEGE3", yahoo: "WEGE3.SA", name: "WEG", sector: "Indústria", dividendYield12m: 2 },
  { symbol: "EMBR3", yahoo: "EMBR3.SA", name: "Embraer", sector: "Indústria", dividendYield12m: 1 },
  // Alimentos & Bebidas
  { symbol: "JBSS3", yahoo: "JBSS3.SA", name: "JBS", sector: "Alimentos & Bebidas", dividendYield12m: 7 },
  { symbol: "BRFS3", yahoo: "BRFS3.SA", name: "BRF", sector: "Alimentos & Bebidas", dividendYield12m: 3 },
  // Construção Civil
  { symbol: "MRVE3", yahoo: "MRVE3.SA", name: "MRV Engenharia", sector: "Construção Civil", dividendYield12m: 5 },
  { symbol: "CYRE3", yahoo: "CYRE3.SA", name: "Cyrela", sector: "Construção Civil", dividendYield12m: 7 },
  // Logística & Transporte
  { symbol: "RAIL3", yahoo: "RAIL3.SA", name: "Rumo Logística", sector: "Logística", dividendYield12m: 2 },
  { symbol: "AZUL4", yahoo: "AZUL4.SA", name: "Azul", sector: "Logística", dividendYield12m: 0 },
  // Telecom
  { symbol: "VIVT3", yahoo: "VIVT3.SA", name: "Vivo", sector: "Telecom", dividendYield12m: 7 },
  { symbol: "TIMS3", yahoo: "TIMS3.SA", name: "TIM", sector: "Telecom", dividendYield12m: 6 },
  // Agronegócio
  { symbol: "SLCE3", yahoo: "SLCE3.SA", name: "SLC Agrícola", sector: "Agronegócio", dividendYield12m: 7 },
  { symbol: "AGRO3", yahoo: "AGRO3.SA", name: "BrasilAgro", sector: "Agronegócio", dividendYield12m: 9 },
];

export const B3_STOCK_SYMBOLS = B3_STOCKS.map((s) => s.symbol);

// Agrupa por setor, retorna chaves únicas em ordem.
export function getSectors(): string[] {
  return [...new Set(B3_STOCKS.map((s) => s.sector))].sort();
}

export const B3_STOCKS_UPDATED_AT = "2026-11-24";
