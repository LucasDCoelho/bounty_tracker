export type TradeSide = 'A' | 'B';

export type TradeBridgeCard = {
  id: string;
  name: string;
  card_number: string;
  image_url: string;
  price: number;
  discount?: number;
  side?: TradeSide;
};

export type DeckBridgeCard = {
  id: string;
  name: string;
  card_number: string;
  image_url: string;
  rarity: string;
  price: number;
};

const TRADE_QUEUE_KEY = 'bountytracker:trade-queue';
const DECK_PENDING_KEY = 'bountytracker:deck-pending-card';
const TRADE_SESSION_KEY = 'bountytracker:trade-session';

export type TradeSessionState = {
  leftCards: TradeBridgeCard[];
  rightCards: TradeBridgeCard[];
  activeSide: TradeSide;
};

export function enqueueTradeCard(card: TradeBridgeCard) {
  if (typeof window === 'undefined') return;

  const queue = readTradeQueue();
  queue.push({
    ...card,
    discount: card.discount ?? 20,
    side: card.side ?? 'A',
  });

  localStorage.setItem(TRADE_QUEUE_KEY, JSON.stringify(queue.slice(-10)));
}

export function consumeTradeQueue(): TradeBridgeCard[] {
  if (typeof window === 'undefined') return [];

  const queue = readTradeQueue();
  localStorage.removeItem(TRADE_QUEUE_KEY);
  return queue;
}

export function saveTradeSession(session: TradeSessionState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TRADE_SESSION_KEY, JSON.stringify(session));
}

export function loadTradeSession(): TradeSessionState | null {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(TRADE_SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as TradeSessionState;
  } catch {
    return null;
  }
}

export function clearTradeSession() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TRADE_SESSION_KEY);
}

export function savePendingDeckCard(card: DeckBridgeCard) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DECK_PENDING_KEY, JSON.stringify(card));
}

export function consumePendingDeckCard(): DeckBridgeCard | null {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(DECK_PENDING_KEY);
  localStorage.removeItem(DECK_PENDING_KEY);

  if (!raw) return null;

  try {
    return JSON.parse(raw) as DeckBridgeCard;
  } catch {
    return null;
  }
}

function readTradeQueue(): TradeBridgeCard[] {
  if (typeof window === 'undefined') return [];

  const raw = localStorage.getItem(TRADE_QUEUE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as TradeBridgeCard[];
  } catch {
    return [];
  }
}
