/**
 * Pure, framework-free logic for the Flashcards tool: data model, an SM-2-light spaced-repetition
 * scheduler, due-card selection and import/export (Anki-compatible TSV + a full JSON backup).
 *
 * Everything here is deterministic (an injectable `now`) and side-effect free, so it is unit-tested
 * in isolation — the React component only wires it to local state + localStorage.
 */

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  /** Consecutive successful reviews — drives the interval ramp. */
  reps: number;
  /** Ease factor (SM-2), clamped to ≥ 1.3. */
  ease: number;
  /** Current interval in days. */
  interval: number;
  /** Next due date (epoch ms). A card is due when `due <= now`. */
  due: number;
}

export interface Deck {
  id: string;
  name: string;
  cards: Flashcard[];
  createdAt: number;
  /** Epoch ms of the last time a copy was published to the shared catalogue (palier C). */
  sharedAt?: number;
}

export type Rating = 'again' | 'hard' | 'good' | 'easy';

export const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;
const DAY = 86_400_000;

/** Stable-enough unique id; prefers the platform UUID, falls back for old engines. */
export function uid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newCard(front: string, back: string, now: number = Date.now()): Flashcard {
  return { id: uid(), front: front.trim(), back: back.trim(), reps: 0, ease: DEFAULT_EASE, interval: 0, due: now };
}

export function newDeck(name: string, now: number = Date.now()): Deck {
  return { id: uid(), name: name.trim() || 'Deck', cards: [], createdAt: now };
}

/**
 * SM-2-light. `again` resets the streak (card stays due now, ease drops); the other ratings ramp the
 * interval (1d → 4/6d → ×ease) and nudge the ease factor the classic SuperMemo way.
 */
export function schedule(card: Flashcard, rating: Rating, now: number = Date.now()): Flashcard {
  const { reps } = card;
  let { ease, interval } = card;

  if (rating === 'again') {
    return { ...card, reps: 0, ease: Math.max(MIN_EASE, ease - 0.2), interval: 0, due: now };
  }

  const q = rating === 'hard' ? 3 : rating === 'good' ? 4 : 5;
  ease = Math.max(MIN_EASE, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  if (reps === 0) interval = rating === 'easy' ? 4 : 1;
  else if (reps === 1) interval = rating === 'hard' ? 3 : 6;
  else interval = Math.max(1, Math.round(interval * (rating === 'hard' ? 1.2 : ease)));

  return { ...card, reps: reps + 1, ease, interval, due: now + interval * DAY };
}

export function isDue(card: Flashcard, now: number = Date.now()): boolean {
  return card.due <= now;
}

/** Due cards, oldest-due first (the natural review order). */
export function dueCards(deck: Deck, now: number = Date.now()): Flashcard[] {
  return deck.cards.filter((c) => isDue(c, now)).sort((a, b) => a.due - b.due);
}

// ── Import / export ─────────────────────────────────────────────────────────

/** Escape a field for TSV: a literal tab/newline would corrupt the row, so collapse them to spaces. */
function tsvField(value: string): string {
  return value.replace(/[\t\r\n]+/g, ' ').trim();
}

/** Tab-separated `front<TAB>back`, one card per line — the format Anki imports natively. */
export function toTsv(deck: Deck): string {
  return deck.cards.map((c) => `${tsvField(c.front)}\t${tsvField(c.back)}`).join('\n');
}

/**
 * Parse pasted/imported card text. Accepts TSV (preferred, Anki default) or CSV; the first tab — or,
 * failing that, the first comma — splits front/back. Blank lines and `#`/`//` comments are skipped.
 */
export function parseCards(text: string): { front: string; back: string }[] {
  const out: { front: string; back: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    const sep = line.includes('\t') ? '\t' : ',';
    const idx = line.indexOf(sep);
    const front = (idx === -1 ? line : line.slice(0, idx)).trim().replace(/^"|"$/g, '');
    const back = (idx === -1 ? '' : line.slice(idx + 1)).trim().replace(/^"|"$/g, '');
    if (front) out.push({ front, back });
  }
  return out;
}

export function decksToJson(decks: Deck[]): string {
  return JSON.stringify({ version: 1, decks }, null, 2);
}

/** Parse a JSON backup, validating shape and healing missing SRS fields. Throws on garbage. */
export function decksFromJson(text: string, now: number = Date.now()): Deck[] {
  const parsed: unknown = JSON.parse(text);
  const rawDecks = Array.isArray(parsed)
    ? parsed
    : (parsed as { decks?: unknown })?.decks;
  if (!Array.isArray(rawDecks)) throw new Error('Invalid backup: no decks array');

  return rawDecks.map((d) => {
    const deck = d as Partial<Deck> & { cards?: unknown };
    if (typeof deck.name !== 'string' || !Array.isArray(deck.cards)) {
      throw new Error('Invalid backup: malformed deck');
    }
    const cards: Flashcard[] = deck.cards.map((c) => {
      const card = c as Partial<Flashcard>;
      const front = typeof card.front === 'string' ? card.front : '';
      const back = typeof card.back === 'string' ? card.back : '';
      return {
        id: typeof card.id === 'string' ? card.id : uid(),
        front,
        back,
        reps: Number.isFinite(card.reps) ? (card.reps as number) : 0,
        ease: Number.isFinite(card.ease) ? (card.ease as number) : DEFAULT_EASE,
        interval: Number.isFinite(card.interval) ? (card.interval as number) : 0,
        due: Number.isFinite(card.due) ? (card.due as number) : now,
      };
    });
    return {
      id: typeof deck.id === 'string' ? deck.id : uid(),
      name: deck.name,
      cards,
      createdAt: Number.isFinite(deck.createdAt) ? (deck.createdAt as number) : now,
      sharedAt: Number.isFinite(deck.sharedAt) ? (deck.sharedAt as number) : undefined,
    };
  });
}
