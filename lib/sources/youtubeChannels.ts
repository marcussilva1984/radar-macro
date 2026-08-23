// Termos usados pra buscar vídeos novos sobre os temas do Radar Macro, mesmo em canais
// que você não segue (vira alerta separado na aba /videos). Foco: economia, macroeconomia,
// geopolítica e criptoativos — nacional + internacional.
export const YOUTUBE_SEARCH_TOPICS = [
  "Federal Reserve Powell juros",
  "banco central Brasil Selic",
  "geopolítica economia mundial",
  "guerra sanções economia global",
  "OPEP petróleo preço",
  "bitcoin criptomoedas mercado",
  "dólar câmbio economia Brasil",
  "China EUA tensão comercial",
];

// Filtro de relevância pros vídeos dos canais que VOCÊ segue — sem isso, com centenas de
// inscrições, a lista vira "tudo que você assiste" (futebol, vlog, etc) em vez de só economia,
// macroeconomia, geopolítica e criptoativos. \b garante limite de palavra (evita "pib" casar em
// "impibecável" etc).
export const RELEVANCE_KEYWORDS = [
  // macroeconomia / bancos centrais
  "fed\\b", "powell", "federal reserve", "fomc",
  "banco central", "selic", "juros", "inflaç", "pib\\b", "recessão", "recession",
  "economia", "macroeconomi", "treasury",
  // câmbio / forex
  "dólar", "câmbio", "forex",
  // criptoativos
  "bitcoin", "cripto", "ethereum", "blockchain", "altcoin", "web3",
  // geopolítica
  "geopolít", "geopolit", "guerra", "war\\b", "ucrânia", "ukraine", "rússia", "russia",
  "china", "taiwan", "irã", "iran", "israel", "oriente médio",
  "petróleo", "opep", "tarifa", "sanç", "sanction", "tariff",
];

export function isRelevantTitle(title: string): boolean {
  const lower = title.toLowerCase();
  return RELEVANCE_KEYWORDS.some((kw) => new RegExp(kw, "i").test(lower));
}
