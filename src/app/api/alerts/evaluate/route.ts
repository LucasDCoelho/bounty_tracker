import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/telegram';

type AlertRow = {
  id: string;
  user_id: string;
  target_price: number;
  current_price_at_creation: number | null;
  telegram_chat_id: string | null;
  card: AlertCard | AlertCard[] | null;
};

type AlertCard = {
  id: string;
  name: string;
  card_number: string;
  current_price_avg: number | null;
};

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function isAuthorized(request: Request, secret: string) {
  const headerSecret = request.headers.get('x-alerts-secret');
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  return headerSecret === secret || bearerToken === secret;
}

export async function POST(request: Request) {
  const secret = process.env.ALERTS_EVALUATE_SECRET;

  if (!secret) {
    return NextResponse.json({ ok: false, error: 'missing_alerts_evaluate_secret' }, { status: 503 });
  }

  if (!isAuthorized(request, secret)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get('dryRun') === '1';

  const supabase = getAdminClient();

  if (!supabase) {
    return NextResponse.json({ ok: false, error: 'missing_supabase_service_role' }, { status: 503 });
  }

  const { data: alerts, error } = await supabase
    .from('user_alerts')
    .select('id, user_id, target_price, current_price_at_creation, telegram_chat_id, card:cards(id, name, card_number, current_price_avg)')
    .eq('is_triggered', false)
    .not('telegram_chat_id', 'is', null);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const typedAlerts = (alerts ?? []) as unknown as AlertRow[];
  const triggeredAlerts: string[] = [];
  const skippedAlerts: string[] = [];

  for (const alert of typedAlerts) {
    const card = Array.isArray(alert.card) ? (alert.card[0] ?? null) : alert.card;
    const currentPrice = Number(card?.current_price_avg ?? 0);
    const targetPrice = Number(alert.target_price ?? 0);

    if (!card || !alert.telegram_chat_id || !Number.isFinite(currentPrice) || !Number.isFinite(targetPrice)) {
      skippedAlerts.push(alert.id);
      continue;
    }

    if (currentPrice > targetPrice) {
      continue;
    }

    const message = [
      'Bounty atingido no BountyTracker!',
      `Carta: ${card.name} (${card.card_number})`,
      `Alvo: ${formatCurrency(targetPrice)}`,
      `Atual: ${formatCurrency(currentPrice)}`,
    ].join('\n');

    const telegramResult = await sendTelegramMessage({
      chatId: alert.telegram_chat_id,
      text: message,
    });

    if (!telegramResult.ok) {
      skippedAlerts.push(alert.id);
      console.error(`Telegram notification failed for alert ${alert.id}:`, telegramResult.error);
      continue;
    }

    if (dryRun) {
      triggeredAlerts.push(alert.id);
      continue;
    }

    const { error: updateError } = await supabase
      .from('user_alerts')
      .update({
        is_triggered: true,
      })
      .eq('id', alert.id);

    if (updateError) {
      skippedAlerts.push(alert.id);
      console.error(`Failed to mark alert ${alert.id} as triggered:`, updateError);
      continue;
    }

    triggeredAlerts.push(alert.id);
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    scanned: typedAlerts.length,
    triggered: triggeredAlerts.length,
    skipped: skippedAlerts.length,
    triggeredAlerts,
    skippedAlerts,
  });
}