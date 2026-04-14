type TelegramMessageInput = {
  chatId: string;
  text: string;
};

export async function sendTelegramMessage({ chatId, text }: TelegramMessageInput) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken || !chatId) {
    return {
      ok: false,
      error: 'telegram_not_configured',
    };
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    return {
      ok: false,
      error: errorPayload?.description ?? `telegram_http_${response.status}`,
    };
  }

  return {
    ok: true,
  };
}