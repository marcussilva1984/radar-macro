// Termos usados pra buscar vídeos novos sobre os temas do Radar Macro, mesmo em canais
// que você não segue (vira alerta separado na aba /videos). Foco internacional: geopolítica,
// macroeconomia, finanças e forex — cripto também, mas política/notícia doméstica do Brasil
// fica de fora (ver EXCLUDE_KEYWORDS).
export const YOUTUBE_SEARCH_TOPICS = [
  "Federal Reserve Powell interest rates",
  "global macroeconomics outlook",
  "geopolitics world economy",
  "war sanctions economy global",
  "OPEC oil price",
  "bitcoin crypto market macro",
  "forex dollar currency outlook",
  "China US trade tension",
];

// Canais brasileiros que você realmente quer ver, mesmo focando em conteúdo internacional —
// esses passam direto, sem aplicar o filtro de exclusão de política doméstica. Ajuste os
// termos conforme o nome exato do canal no YouTube (casamento por substring, case-insensitive).
export const TRUSTED_BR_CHANNELS = ["igor mundstock", "renauld adorno", "renaud adorno", "omnimacro", "omni macro"];

// Filtro de relevância pros vídeos dos canais que VOCÊ segue — sem isso, com centenas de
// inscrições, a lista vira "tudo que você assiste" (futebol, vlog, etc). \b garante limite de
// palavra (evita "pib" casar em "impibecável" etc).
export const RELEVANCE_KEYWORDS = [
  // macroeconomia / bancos centrais
  "\\bfed\\b", "powell", "federal reserve", "fomc", "central bank",
  "banco central", "selic", "juros", "inflaç", "inflation", "\\bpib\\b", "\\bgdp\\b",
  "recessão", "recession", "macroeconomi", "treasury", "interest rate",
  // câmbio / forex
  "dólar", "dollar", "câmbio", "\\bforex\\b", "currency",
  // criptoativos
  "bitcoin", "cripto", "crypto", "ethereum", "blockchain", "altcoin", "web3",
  // geopolítica
  "geopolít", "geopolit", "guerra", "\\bwar\\b", "ucrânia", "ukraine", "rússia", "russia",
  "china", "taiwan", "\\birã\\b", "\\biran\\b", "israel", "middle east", "oriente médio",
  "petróleo", "\\boil\\b", "opep", "opec", "tarifa", "tariff", "sanç", "sanction",
];

// Ruído de política doméstica brasileira que costuma bater em keywords genéricas
// ("economia", "juros") sem ser sobre macro/geopolítica de fato — filtrado, exceto pros
// canais de TRUSTED_BR_CHANNELS.
const EXCLUDE_KEYWORDS = [
  "lula", "bolsonaro", "datafolha", "eleiç", "\\belection\\b",
  "renan santos", "pablo marçal", "flávio bolsonaro", "moraes", "\\bstf\\b",
];

// Formatos que você não quer, independente do tema — vídeo curto (short), live, entrevista,
// podcast, debate. Isso vale SEMPRE, até pros canais de TRUSTED_BR_CHANNELS (o filtro de
// política doméstica é que é pulado pra eles, não o de formato).
const EXCLUDE_FORMAT_KEYWORDS = [
  "#shorts", "\\bshorts\\b", "\\blive\\b", "\\bao vivo\\b", "livestream",
  "\\binterview\\b", "\\bentrevista\\b", "\\bpodcast\\b", "\\bdebate\\b", "\\bq&a\\b", "\\bama\\b",
];

function matches(list: string[], lower: string): boolean {
  return list.some((kw) => new RegExp(kw, "i").test(lower));
}

export function isTrustedBrChannel(channelTitle: string): boolean {
  const lower = channelTitle.toLowerCase();
  return TRUSTED_BR_CHANNELS.some((c) => lower.includes(c));
}

export function isRelevantTitle(title: string, channelTitle = ""): boolean {
  const lower = title.toLowerCase();
  if (matches(EXCLUDE_FORMAT_KEYWORDS, lower)) return false;
  if (isTrustedBrChannel(channelTitle)) return true;
  return matches(RELEVANCE_KEYWORDS, lower) && !matches(EXCLUDE_KEYWORDS, lower);
}
