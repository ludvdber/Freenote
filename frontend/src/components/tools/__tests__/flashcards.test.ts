import { describe, it, expect } from 'vitest';
import {
  newCard, newDeck, schedule, isDue, dueCards,
  toTsv, parseCards, decksToJson, decksFromJson, DEFAULT_EASE,
} from '../flashcards/logic';
import type { Deck } from '../flashcards/logic';
import { htmlToText, fieldsToCard } from '../flashcards/apkg';

const DAY = 86_400_000;
const NOW = 1_700_000_000_000;

describe('flashcards — spaced repetition', () => {
  it('ramps the interval 1d → 6d → ×ease on successive "good" answers', () => {
    const c0 = newCard('q', 'a', NOW);
    const c1 = schedule(c0, 'good', NOW);
    expect(c1.reps).toBe(1);
    expect(c1.interval).toBe(1);
    expect(c1.due).toBe(NOW + 1 * DAY);

    const c2 = schedule(c1, 'good', NOW);
    expect(c2.reps).toBe(2);
    expect(c2.interval).toBe(6);

    const c3 = schedule(c2, 'good', NOW);
    expect(c3.interval).toBe(Math.round(6 * c2.ease));
    expect(c3.interval).toBeGreaterThan(6);
  });

  it('"easy" on a new card jumps further than "good"', () => {
    const c0 = newCard('q', 'a', NOW);
    expect(schedule(c0, 'easy', NOW).interval).toBe(4);
    expect(schedule(c0, 'good', NOW).interval).toBe(1);
  });

  it('"again" resets the streak, drops the ease and re-queues the card now', () => {
    const learned = schedule(schedule(newCard('q', 'a', NOW), 'good', NOW), 'good', NOW);
    const lapsed = schedule(learned, 'again', NOW);
    expect(lapsed.reps).toBe(0);
    expect(lapsed.interval).toBe(0);
    expect(lapsed.due).toBe(NOW);
    expect(lapsed.ease).toBeLessThan(learned.ease);
    expect(lapsed.ease).toBeGreaterThanOrEqual(1.3);
  });

  it('never lets the ease fall below 1.3', () => {
    let card = newCard('q', 'a', NOW);
    for (let i = 0; i < 20; i++) card = schedule(card, 'again', NOW);
    expect(card.ease).toBeGreaterThanOrEqual(1.3);
  });

  it('selects only due cards, oldest first', () => {
    const deck: Deck = newDeck('d', NOW);
    deck.cards = [
      { ...newCard('due-later', '', NOW), due: NOW - 10 },
      { ...newCard('not-due', '', NOW), due: NOW + DAY },
      { ...newCard('due-first', '', NOW), due: NOW - 1000 },
    ];
    const due = dueCards(deck, NOW);
    expect(due.map((c) => c.front)).toEqual(['due-first', 'due-later']);
    expect(isDue(deck.cards[1], NOW)).toBe(false);
  });
});

describe('flashcards — import / export', () => {
  it('parses TSV, CSV and skips blanks/comments', () => {
    const parsed = parseCards('q1\ta1\n# comment\n\nq2,a2\nlonely');
    expect(parsed).toEqual([
      { front: 'q1', back: 'a1' },
      { front: 'q2', back: 'a2' },
      { front: 'lonely', back: '' },
    ]);
  });

  it('exports a deck to TSV and round-trips through parseCards', () => {
    const deck = newDeck('d', NOW);
    deck.cards = [newCard('front 1', 'back 1', NOW), newCard('front 2', 'back 2', NOW)];
    const tsv = toTsv(deck);
    expect(tsv).toBe('front 1\tback 1\nfront 2\tback 2');
    expect(parseCards(tsv)).toEqual([
      { front: 'front 1', back: 'back 1' },
      { front: 'front 2', back: 'back 2' },
    ]);
  });

  it('round-trips decks through JSON and heals missing SRS fields', () => {
    const deck = newDeck('Compta', NOW);
    deck.cards = [newCard('q', 'a', NOW)];
    const restored = decksFromJson(decksToJson([deck]));
    expect(restored).toHaveLength(1);
    expect(restored[0].name).toBe('Compta');
    expect(restored[0].cards[0].ease).toBe(DEFAULT_EASE);

    const healed = decksFromJson('{"decks":[{"name":"x","cards":[{"front":"f","back":"b"}]}]}', NOW);
    expect(healed[0].cards[0].due).toBe(NOW);
    expect(healed[0].cards[0].reps).toBe(0);
  });

  it('throws on malformed backups', () => {
    expect(() => decksFromJson('not json')).toThrow();
    expect(() => decksFromJson('{"decks":[{"cards":[]}]}')).toThrow();
  });
});

describe('flashcards — Anki .apkg field parsing', () => {
  it('strips Anki field HTML to plain text', () => {
    expect(htmlToText('Hello&nbsp;<b>world</b>')).toBe('Hello world');
    expect(htmlToText('line1<br>line2')).toBe('line1\nline2');
    expect(htmlToText('q [sound:a.mp3]')).toBe('q');
    expect(htmlToText('R&amp;D &lt;tag&gt; &#39;x&#39;')).toBe("R&D <tag> 'x'");
  });

  it('decodes hexadecimal HTML entities (Anki exports use &#x27; for apostrophes)', () => {
    expect(htmlToText("d&#x27;une expérience")).toBe("d'une expérience");
    expect(htmlToText('a &#x2019; b')).toBe('a ’ b');
    // &amp; is decoded last so an escaped entity survives instead of being double-decoded.
    expect(htmlToText('&amp;lt;')).toBe('&lt;');
  });

  it('maps note fields (separated by \\x1f) to front/back, joining extra fields into the back', () => {
    expect(fieldsToCard(['<b>Q</b>', 'A'])).toEqual({ front: 'Q', back: 'A' });
    expect(fieldsToCard(['Q', 'A', 'extra'])).toEqual({ front: 'Q', back: 'A\nextra' });
    expect(fieldsToCard(['only'])).toEqual({ front: 'only', back: '' });
  });
});
