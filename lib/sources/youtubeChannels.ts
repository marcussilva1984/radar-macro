// Termos usados pra buscar vídeos novos sobre os temas do Radar Macro, mesmo em canais
// que você não segue (vira alerta separado na aba /videos). Mistura internacional + nacional.
export const YOUTUBE_SEARCH_TOPICS = [
  "Federal Reserve Powell",
  "banco central juros Brasil",
  "geopolítica mercado financeiro",
  "guerra sanções economia",
  "OPEP petróleo preço",
  "bitcoin ETF fluxo",
  "dólar câmbio Brasil hoje",
  "mercado financeiro hoje análise",
];

// Filtro de relevância pros vídeos dos canais que VOCÊ segue — sem isso, com centenas de
// inscrições, a lista vira "tudo que você assiste" (futebol, vlog, etc) em vez de só o que
// interessa ao Radar Macro. \b garante limite de palavra (evita "pib" casar em "impibecável" etc).
export const RELEVANCE_KEYWORDS = [
  "fed", "powell", "federal reserve", "fomc",
  "banco central", "selic", "juros", "inflaç", "pib\\b",
  "dólar", "câmbio", "bolsa", "ibovespa", "ações",
  "bitcoin", "cripto", "ethereum", "ouro\\b",
  "petróleo", "opep", "tarifa", "sanç", "sanction", "tariff",
  "guerra", "war\\b", "ucrânia", "rússia", "russia", "ukraine",
  "geopolít", "geopolit", "mercado financeiro", "recessão", "recession",
  "investimento", "fii\\b", "dividendo", "treasury", "eleiç", "election",
];

export function isRelevantTitle(title: string): boolean {
  const lower = title.toLowerCase();
  return RELEVANCE_KEYWORDS.some((kw) => new RegExp(kw, "i").test(lower));
}
