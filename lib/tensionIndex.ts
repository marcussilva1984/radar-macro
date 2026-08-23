import "server-only";
import { getMentionsTrend } from "@/lib/mentions";
import { getForexBoard, type TradeIdea } from "@/lib/forex";
import { getCorrelationShifts, type CorrelationShift } from "@/lib/correlations";
import { getFlowMap, type FlowNode } from "@/lib/flowMap";
import { getNextEvent, type CalendarEvent } from "@/lib/sources/economicCalendar";

export interface TensionIndex {
  score: number; // 0-100
  level: "baixa" | "média" | "alta";
  headline: string; // ex: "geopolítica em alta, USD fraco, correlações quebrando"
  components: {
    mentions: number;
    forexConviction: number;
    correlationBreaks: number;
    flowExtremes: number;
  };
  // Pra montar o "resumo executivo" na home sem repetir as consultas.
  topForexIdea: TradeIdea | null;
  topCorrelationBreak: CorrelationShift | null;
  topFlowNode: FlowNode | null;
  nextEvent: (CalendarEvent & { daysUntil: number }) | null;
}

// Índice único (0-100) sintetizando as 4 abas do app numa manchete só — a "marca" do Radar
// Semanal. Cada componente é normalizado independentemente e a média vira o score final.
export async function getTensionIndex(): Promise<TensionIndex> {
  const [mentions, { ideas, strength }, correlationShifts, flowNodes] = await Promise.all([
    getMentionsTrend(),
    getForexBoard(),
    getCorrelationShifts(),
    getFlowMap(),
  ]);

  // 1. Menções: proporção de tags com alta relevante essa semana (>30%) — narrativa esquentando.
  const risingTags = mentions.filter((m) => m.changePct !== null && m.changePct > 30);
  const mentionsComponent = mentions.length > 0 ? (risingTags.length / mentions.length) * 100 : 0;

  // 2. Forex: proporção de ideias com convicção forte — quanto mais alinhados os sinais, maior.
  const forexComponent = ideas.length > 0 ? (ideas.filter((i) => i.conviction === "forte").length / ideas.length) * 100 : 0;

  // 3. Correlações: proporção de pares com quebra relevante (shift > 0.4) — narrativa nova.
  const brokenCorrelations = correlationShifts.filter((s) => (s.shift ?? 0) > 0.4);
  const correlationComponent =
    correlationShifts.length > 0 ? (brokenCorrelations.length / correlationShifts.length) * 100 : 0;

  // 4. Fluxo: magnitude do maior movimento semanal (25%+ já é considerado "no teto").
  const maxFlowMove = Math.max(0, ...flowNodes.map((n) => Math.abs(n.weeklyChangePct)));
  const flowComponent = Math.min(100, (maxFlowMove / 25) * 100);

  const score = Math.round((mentionsComponent + forexComponent + correlationComponent + flowComponent) / 4);
  const level: TensionIndex["level"] = score >= 70 ? "alta" : score >= 40 ? "média" : "baixa";

  const parts: string[] = [];
  if (risingTags.length > 0) parts.push(`${risingTags[0].tag} em alta`);
  const topWeakStrong = [...strength].sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0];
  if (topWeakStrong && Math.abs(topWeakStrong.score) > 0.15) {
    parts.push(`${topWeakStrong.currency} ${topWeakStrong.score >= 0 ? "forte" : "fraco"}`);
  }
  if (brokenCorrelations.length > 0) parts.push("correlações quebrando");
  if (maxFlowMove > 10) {
    const leader = flowNodes.find((n) => Math.abs(n.weeklyChangePct) === maxFlowMove);
    if (leader) parts.push(`${leader.label} ${leader.weeklyChangePct >= 0 ? "disparando" : "despencando"}`);
  }

  const topFlowNode =
    flowNodes.length > 0
      ? [...flowNodes].sort((a, b) => Math.abs(b.weeklyChangePct) - Math.abs(a.weeklyChangePct))[0]
      : null;
  const topCorrelationBreak =
    correlationShifts.length > 0
      ? [...correlationShifts].sort((a, b) => (b.shift ?? 0) - (a.shift ?? 0))[0]
      : null;
  const topForexIdea = ideas.find((i) => i.conviction === "forte") ?? ideas[0] ?? null;
  const nextEvent = getNextEvent();

  return {
    score,
    level,
    headline: parts.length > 0 ? parts.join(", ") : "semana tranquila, sem sinais fortes",
    components: {
      mentions: Math.round(mentionsComponent),
      forexConviction: Math.round(forexComponent),
      correlationBreaks: Math.round(correlationComponent),
      flowExtremes: Math.round(flowComponent),
    },
    topForexIdea,
    topCorrelationBreak,
    topFlowNode,
    nextEvent,
  };
}
