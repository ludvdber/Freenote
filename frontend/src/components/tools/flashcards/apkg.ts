/**
 * Anki `.apkg` *import* (reading existing decks). An `.apkg` is a ZIP holding a SQLite collection
 * (`collection.anki2`/`collection.anki21`) whose `notes.flds` column stores the fields joined by the
 * unit separator `\x1f`. We unzip with fflate and read the SQLite with sql.js (WebAssembly).
 *
 * Both heavy libraries are **dynamically imported** so the ~1 MB WASM only downloads when the user
 * actually imports an `.apkg` — never on first paint. The wasm URL is a static (string-only) import,
 * so no binary is fetched until `initSqlJs` runs. Requires CSP `script-src 'wasm-unsafe-eval'`.
 *
 * Export stays as Anki-native TSV (see logic.ts) — a format we can guarantee Anki imports, rather
 * than hand-writing a fragile `.apkg` SQLite we cannot verify against a real Anki here.
 */
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

export type ApkgErrorCode = 'recent-format' | 'not-apkg' | 'empty';

/** Coded error so the UI can show a precise message (recent zstd format vs. not an apkg). */
export class ApkgError extends Error {
  code: ApkgErrorCode;
  constructor(code: ApkgErrorCode) {
    super(code);
    this.name = 'ApkgError';
    this.code = code;
  }
}

/** Safe numeric-entity → char (invalid/out-of-range code points collapse to empty rather than throw). */
function codePoint(n: number): string {
  return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
}

/** Strip Anki field HTML down to plain text (our cards are plain text). Pure + unit-tested. */
export function htmlToText(html: string): string {
  return html
    .replace(/\[sound:[^\]]*\]/g, '')           // Anki audio references
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')                      // remaining tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => codePoint(parseInt(h, 16)))   // hex entities e.g. &#x27; → '
    .replace(/&#(\d+);/g, (_, n: string) => codePoint(Number(n)))                  // decimal entities e.g. &#39; → '
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')                        // decode &amp; LAST so &amp;lt; stays &lt;
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Map a note's raw fields → a front/back card. First field is the front, the rest join as the back. */
export function fieldsToCard(flds: string[]): { front: string; back: string } {
  return {
    front: htmlToText(flds[0] ?? ''),
    back: htmlToText(flds.slice(1).join('\n')),
  };
}

export async function importApkg(buffer: ArrayBuffer): Promise<{ front: string; back: string }[]> {
  const { unzipSync } = await import('fflate');
  const files = unzipSync(new Uint8Array(buffer));

  // Resolve the SQLite collection. Modern Anki (2.1.50+) ships `collection.anki21b` — a *zstd-
  // compressed* SQLite — alongside a STUB `collection.anki2` that holds a single "update Anki"
  // note for legacy clients. So we must NOT just read `collection.anki2`: prefer the zstd file
  // (decompress it) > the uncompressed new schema > the legacy file.
  let sqlite: Uint8Array;
  if (files['collection.anki21b']) {
    const { decompress } = await import('fzstd');
    try {
      sqlite = decompress(files['collection.anki21b']);
    } catch {
      throw new ApkgError('recent-format');
    }
  } else if (files['collection.anki21']) {
    sqlite = files['collection.anki21'];
  } else if (files['collection.anki2']) {
    sqlite = files['collection.anki2'];
  } else {
    throw new ApkgError('not-apkg');
  }

  const initSqlJs = (await import('sql.js/dist/sql-wasm.js')).default;
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const db = new SQL.Database(sqlite);
  try {
    const result = db.exec('SELECT flds FROM notes');
    const cards: { front: string; back: string }[] = [];
    for (const row of result[0]?.values ?? []) {
      const card = fieldsToCard(String(row[0] ?? '').split('\x1f'));
      if (card.front) cards.push(card);
    }
    if (cards.length === 0) throw new ApkgError('empty');
    return cards;
  } finally {
    db.close();
  }
}
