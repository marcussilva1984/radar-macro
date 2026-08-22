// Canais que você acompanha (nacional + internacional) sobre macro/geopolítica/mercado.
// EDITE esta lista com os canais que você realmente segue — sem OAuth não dá pra ler suas
// inscrições reais do YouTube, então essa lista faz esse papel manualmente por enquanto.
// Pra achar o channelId de um canal: abra o canal -> "Sobre" -> "Compartilhar canal" -> Copiar
// ID do canal (formato UCxxxxxxxxxxxxxxxxxxxxxx).
export const FOLLOWED_CHANNELS: Array<{ channelId: string; label: string }> = [
  // { channelId: "UCxxxxxxxxxxxxxxxxxxxxxx", label: "Nome do canal" },
];

// Termos usados pra buscar vídeos novos sobre os temas do Radar Macro, mesmo em canais
// que você não segue (vira alerta separado na aba /videos).
export const YOUTUBE_SEARCH_TOPICS = [
  "Federal Reserve",
  "Powell juros",
  "banco central juros",
  "geopolitica mercado financeiro",
  "guerra sanções economia",
  "OPEP petróleo",
  "bitcoin ETF fluxo",
];
