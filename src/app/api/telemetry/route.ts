import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

type TelemetryPayload = {
  eventName?: string;
  properties?: Record<string, string | number | boolean | null | undefined>;
  path?: string;
  referrer?: string | null;
  createdAt?: string;
};

const MAX_PROPERTIES = 20;
const MAX_PROPERTY_KEY_LENGTH = 64;
const MAX_PROPERTY_VALUE_LENGTH = 256;
const MAX_PATH_LENGTH = 256;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;

const ALLOWED_EVENTS = new Set([
  'alert_created',
  'buylist_view',
  'card_view',
  'collection_add',
  'deckbuilder_card_added',
  'deckbuilder_card_removed',
  'deckbuilder_leader_set',
  'deckbuilder_saved',
  'deckbuilder_view',
  'market_search',
  'market_view',
  'radar_view',
  'scanner_failure',
  'scanner_launch_to_calculator',
  'scanner_no_match',
  'scanner_success',
  'scanner_view',
  'send_to_calculator',
  'send_to_deckbuilder',
  'trade_calculator_view',
  'trade_card_added',
  'trade_card_moved',
  'trade_card_removed',
  'trade_cleared',
  'trade_discount_changed',
  'trade_undo',
]);

const ipRateLimitStore = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  return request.headers.get('x-real-ip') || 'unknown';
}

function isRateLimited(request: Request) {
  const now = Date.now();
  const ip = getClientIp(request);
  const entry = ipRateLimitStore.get(ip);

  if (!entry || now > entry.resetAt) {
    ipRateLimitStore.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count += 1;
  return false;
}

function isValidOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;

  const host = request.headers.get('host');
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function sanitizeProperties(input: TelemetryPayload['properties']) {
  if (!input || typeof input !== 'object') return {};

  const entries = Object.entries(input).slice(0, MAX_PROPERTIES);
  const sanitized: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of entries) {
    const cleanKey = key.trim().slice(0, MAX_PROPERTY_KEY_LENGTH);
    if (!cleanKey) continue;

    if (value === null || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[cleanKey] = value;
      continue;
    }

    if (typeof value === 'string') {
      sanitized[cleanKey] = value.slice(0, MAX_PROPERTY_VALUE_LENGTH);
    }
  }

  return sanitized;
}

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

export async function POST(request: Request) {
  if (!isValidOrigin(request)) {
    return NextResponse.json({ ok: false, error: 'invalid_origin' }, { status: 403 });
  }

  if (isRateLimited(request)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  let payload: TelemetryPayload = {};

  try {
    payload = (await request.json()) as TelemetryPayload;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  if (!payload.eventName || !ALLOWED_EVENTS.has(payload.eventName)) {
    return NextResponse.json({ ok: false, error: 'missing_event_name' }, { status: 400 });
  }

  const safePath = payload.path ? String(payload.path).slice(0, MAX_PATH_LENGTH) : null;
  const safeReferrer = payload.referrer ? String(payload.referrer).slice(0, MAX_PATH_LENGTH) : null;
  const safeProperties = sanitizeProperties(payload.properties);

  const supabase = getAdminClient();
  if (!supabase) {
    return NextResponse.json({ ok: true, stored: false, reason: 'telemetry_disabled' });
  }

  const { error } = await supabase.from('product_events').insert([
    {
      event_name: payload.eventName,
      path: safePath,
      referrer: safeReferrer,
      properties: safeProperties,
      created_at: payload.createdAt ?? new Date().toISOString(),
    },
  ]);

  if (error) {
    console.error('Failed to store telemetry event:', error);
    return NextResponse.json({ ok: true, stored: false, error: error.message });
  }

  return NextResponse.json({ ok: true, stored: true });
}