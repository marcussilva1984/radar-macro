// FIIs rastreados: símbolo, tipo, VPA (atualizado trimestralmente), DY mensal estimado e dia
// de pagamento habitual. VPA = valor patrimonial por cota (usado pra calcular P/VP).
export type FiiType = "Tijolo" | "Papel" | "Híbrido" | "FoF";

export interface B3Fii {
  symbol: string;
  yahoo: string;
  name: string;
  type: FiiType;
  vpa: number;         // Valor Patrimonial por Cota — atualizado manualmente a cada trimestre
  monthlyDY: number;   // DY mensal estimado (% — ex: 0.95 = 0,95%/mês)
  payDay?: number;     // dia do mês em que costuma pagar (undefined = irregular)
}

export const B3_FIIS: B3Fii[] = [
  // Tijolo — Logística
  { symbol: "XPLG11", yahoo: "XPLG11.SA", name: "XP Log", type: "Tijolo", vpa: 108, monthlyDY: 0.85, payDay: 15 },
  { symbol: "BRCO11", yahoo: "BRCO11.SA", name: "Bresco Logística", type: "Tijolo", vpa: 110, monthlyDY: 0.75, payDay: 14 },
  { symbol: "LVBI11", yahoo: "LVBI11.SA", name: "VBI Logístico", type: "Tijolo", vpa: 103, monthlyDY: 0.80, payDay: 15 },
  { symbol: "BTLG11", yahoo: "BTLG11.SA", name: "BTG Logística", type: "Tijolo", vpa: 107, monthlyDY: 0.78, payDay: 16 },
  // Tijolo — Escritórios
  { symbol: "BRCR11", yahoo: "BRCR11.SA", name: "BC Fund", type: "Tijolo", vpa: 90, monthlyDY: 0.70, payDay: 13 },
  { symbol: "RCRB11", yahoo: "RCRB11.SA", name: "Rio Bravo Crédito", type: "Tijolo", vpa: 95, monthlyDY: 0.65, payDay: 14 },
  { symbol: "PVBI11", yahoo: "PVBI11.SA", name: "VBI Prime Properties", type: "Tijolo", vpa: 98, monthlyDY: 0.72, payDay: 15 },
  // Tijolo — Shopping
  { symbol: "XPML11", yahoo: "XPML11.SA", name: "XP Malls", type: "Tijolo", vpa: 112, monthlyDY: 0.88, payDay: 15 },
  { symbol: "HSML11", yahoo: "HSML11.SA", name: "HSI Malls", type: "Tijolo", vpa: 90, monthlyDY: 0.82, payDay: 14 },
  { symbol: "MALL11", yahoo: "MALL11.SA", name: "Malls Brasil Plural", type: "Tijolo", vpa: 100, monthlyDY: 0.90, payDay: 16 },
  // Papel — CRI/LCI
  { symbol: "MXRF11", yahoo: "MXRF11.SA", name: "Maxi Renda", type: "Papel", vpa: 10, monthlyDY: 1.05, payDay: 16 },
  { symbol: "KNCR11", yahoo: "KNCR11.SA", name: "Kinea Rendimentos", type: "Papel", vpa: 108, monthlyDY: 1.00, payDay: 15 },
  { symbol: "KNIP11", yahoo: "KNIP11.SA", name: "Kinea Índices de Preços", type: "Papel", vpa: 115, monthlyDY: 0.95, payDay: 15 },
  { symbol: "VRTA11", yahoo: "VRTA11.SA", name: "Fator Verità", type: "Papel", vpa: 105, monthlyDY: 1.10, payDay: 14 },
  { symbol: "RBRR11", yahoo: "RBRR11.SA", name: "RBR Rendimento High Grade", type: "Papel", vpa: 102, monthlyDY: 1.00, payDay: 15 },
  // Híbrido
  { symbol: "HGRU11", yahoo: "HGRU11.SA", name: "CSHG Renda Urbana", type: "Híbrido", vpa: 128, monthlyDY: 0.78, payDay: 14 },
  { symbol: "VINO11", yahoo: "VINO11.SA", name: "Vinci Offices", type: "Híbrido", vpa: 65, monthlyDY: 0.75, payDay: 15 },
  // FoF
  { symbol: "BCFF11", yahoo: "BCFF11.SA", name: "BC Fund FoF", type: "FoF", vpa: 70, monthlyDY: 0.72, payDay: 14 },
  { symbol: "RBRF11", yahoo: "RBRF11.SA", name: "RBR Alpha FoF", type: "FoF", vpa: 85, monthlyDY: 0.78, payDay: 15 },
  { symbol: "BPFF11", yahoo: "BPFF11.SA", name: "Brasil Plural FoF", type: "FoF", vpa: 72, monthlyDY: 0.70, payDay: 16 },
];

export const B3_FII_SYMBOLS = B3_FIIS.map((f) => f.symbol);

export const B3_FIIS_UPDATED_AT = "2026-11-24";
