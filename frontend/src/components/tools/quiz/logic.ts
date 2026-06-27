/**
 * Pure, framework-free logic for the Quiz tool: data model, client-side grading, validation,
 * localStorage (de)serialisation and the URL-encoding used to share an *ephemeral* quiz with anyone
 * (no backend, no account). Everything here is deterministic and side-effect free, so it is unit-tested
 * in isolation — the React component only wires it to local state, the API and the URL hash.
 */

export interface QuizQuestion {
  id: string;
  question: string;
  /** 2–6 answer choices. */
  choices: string[];
  /** 0-based index of the correct choice. */
  answer: number;
}

export interface Quiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
  createdAt: number;
  /** Epoch ms of the last time this quiz was published to the shared catalogue. */
  sharedAt?: number;
}

export const MIN_CHOICES = 2;
export const MAX_CHOICES = 6;

/** Stable-enough unique id; prefers the platform UUID, falls back for old engines. */
export function uid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newQuestion(): QuizQuestion {
  return { id: uid(), question: '', choices: ['', ''], answer: 0 };
}

export function newQuiz(title: string, now: number = Date.now()): Quiz {
  return { id: uid(), title: title.trim() || 'Quiz', questions: [newQuestion()], createdAt: now };
}

// ── Grading (client-side, for ephemeral play) ────────────────────────────────

/** Number of correct answers. `answers[i]` is the chosen index for question i (null/undefined = skipped). */
export function gradeQuiz(quiz: Quiz, answers: (number | null)[]): { score: number; total: number } {
  let score = 0;
  quiz.questions.forEach((q, i) => {
    if (answers[i] != null && answers[i] === q.answer) score++;
  });
  return { score, total: quiz.questions.length };
}

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * Returns an i18n error key if the quiz can't be published/shared, else null. Mirrors the backend
 * Bean Validation + the cross-field answer-range rule, so the UI fails fast before a round-trip.
 */
export function validateQuiz(quiz: Quiz): string | null {
  if (!quiz.title.trim()) return 'errTitle';
  if (quiz.questions.length === 0) return 'errNoQuestions';
  for (const q of quiz.questions) {
    if (!q.question.trim()) return 'errQuestionText';
    const filled = q.choices.map((c) => c.trim()).filter(Boolean);
    if (filled.length < MIN_CHOICES) return 'errChoices';
    if (q.answer < 0 || q.answer >= q.choices.length || !q.choices[q.answer]?.trim()) return 'errAnswer';
  }
  return null;
}

/** Drop blank trailing choices and trim, keeping the answer pointing at the right choice. */
export function normalizeQuiz(quiz: Quiz): Quiz {
  return {
    ...quiz,
    title: quiz.title.trim(),
    questions: quiz.questions.map((q) => {
      const correct = q.choices[q.answer];
      const choices = q.choices.map((c) => c.trim()).filter(Boolean);
      const answer = Math.max(0, choices.indexOf((correct ?? '').trim()));
      return { ...q, question: q.question.trim(), choices, answer };
    }),
  };
}

// ── localStorage backup ──────────────────────────────────────────────────────

export function quizzesToJson(quizzes: Quiz[]): string {
  return JSON.stringify({ version: 1, quizzes });
}

/** Parse the localStorage blob, validating shape and healing missing fields. Throws on garbage. */
export function quizzesFromJson(text: string, now: number = Date.now()): Quiz[] {
  const parsed: unknown = JSON.parse(text);
  const raw = Array.isArray(parsed) ? parsed : (parsed as { quizzes?: unknown })?.quizzes;
  if (!Array.isArray(raw)) throw new Error('Invalid quiz backup');
  return raw.map((q) => healQuiz(q, now));
}

function healQuiz(input: unknown, now: number): Quiz {
  const q = input as Partial<Quiz> & { questions?: unknown };
  if (typeof q.title !== 'string' || !Array.isArray(q.questions)) {
    throw new Error('Malformed quiz');
  }
  return {
    id: typeof q.id === 'string' ? q.id : uid(),
    title: q.title,
    createdAt: Number.isFinite(q.createdAt) ? (q.createdAt as number) : now,
    sharedAt: Number.isFinite(q.sharedAt) ? (q.sharedAt as number) : undefined,
    questions: q.questions.map(healQuestion),
  };
}

function healQuestion(input: unknown): QuizQuestion {
  const q = input as Partial<QuizQuestion>;
  const choices = Array.isArray(q.choices) ? q.choices.map((c) => String(c)) : ['', ''];
  const answer = Number.isInteger(q.answer) ? (q.answer as number) : 0;
  return {
    id: typeof q.id === 'string' ? q.id : uid(),
    question: typeof q.question === 'string' ? q.question : '',
    choices,
    answer: answer >= 0 && answer < choices.length ? answer : 0,
  };
}

// ── Ephemeral URL sharing (no backend) ───────────────────────────────────────
//
// A quiz is packed into a compact `{ t, q:[{q,c,a}] }` shape, JSON-encoded, then base64url-encoded so
// it rides in the URL hash. Anyone (even logged-out) can open the link and play 100% client-side — no
// storage, no account, no leaderboard. The answers ARE present in the payload (a curious player could
// decode them), which is fine for a casual shared quiz with no score stakes.

interface CompactQuiz {
  t: string;
  q: { q: string; c: string[]; a: number }[];
}

/** UTF-8-safe base64url of an arbitrary string. */
function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeQuiz(quiz: Quiz): string {
  const n = normalizeQuiz(quiz);
  const compact: CompactQuiz = {
    t: n.title,
    q: n.questions.map((q) => ({ q: q.question, c: q.choices, a: q.answer })),
  };
  return toBase64Url(JSON.stringify(compact));
}

/** Decode a shared quiz back into a playable Quiz (fresh ids). Throws on malformed input. */
export function decodeQuiz(encoded: string, now: number = Date.now()): Quiz {
  const parsed = JSON.parse(fromBase64Url(encoded)) as CompactQuiz;
  if (typeof parsed.t !== 'string' || !Array.isArray(parsed.q) || parsed.q.length === 0) {
    throw new Error('Invalid shared quiz');
  }
  const quiz: Quiz = {
    id: uid(),
    title: parsed.t,
    createdAt: now,
    questions: parsed.q.map((q) => {
      if (typeof q.q !== 'string' || !Array.isArray(q.c) || q.c.length < MIN_CHOICES) {
        throw new Error('Invalid shared question');
      }
      const choices = q.c.map((c) => String(c));
      const answer = Number.isInteger(q.a) && q.a >= 0 && q.a < choices.length ? q.a : 0;
      return { id: uid(), question: q.q, choices, answer };
    }),
  };
  return quiz;
}
