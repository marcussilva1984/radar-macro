import "server-only";

// Reusa o mesmo bot do Terminal de Mercado — TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID
// configurados separadamente aqui (não lemos do outro projeto).
export async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return; // sem credencial configurada, silenciosamente não envia

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram: ${res.status} ${body}`);
  }
}
