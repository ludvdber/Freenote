/**
 * Pure, framework-free logic for the Quiz tool: data model, client-side grading, validation,
 * localStorage (de)serialisation and the URL-encoding used to share an *ephemeral* quiz with anyone
 * (no backend, no account). Everything here is deterministic and side-effect free, so it is unit-tested
 * in isolation — the React component only wires it to local state, the API and the URL hash.
 */

export type QuestionType = 'mcq' | 'open';

export interface QuizQuestion {
  id: string;
  type: QuestionType;
  question: string;
  /** MCQ: 2–6 answer choices. */
  choices: string[];
  /** MCQ: 0-based index of the correct choice. */
  answer: number;
  /** Open question: the expected answer (matched case/space-insensitively). */
  openAnswer: string;
  /** Optional base64 data URI — published quizzes only, never carried in a share link. */
  image?: string;
  /** Optional code snippet (syntax-highlighted at render) + its language hint. */
  code?: string;
  language?: string;
  /** Optional author explanation, shown only on the post-grading review screen. */
  explanation?: string;
}

export interface Quiz {
  id: string;
  title: string;
  questions: QuizQuestion[];
  createdAt: number;
  /** Epoch ms of the last time this quiz was published to the shared catalogue. */
  sharedAt?: number;
  /** Id of the linked server row (compte connecte) — absent tant que jamais enregistre en ligne. */
  serverId?: number;
  /** Etat publie de la copie serveur (bibliotheque) ; false/absent = enregistrement prive. */
  published?: boolean;
  /** Rattachement optionnel a un cours (surface « Reviser ce cours » des pages documents) —
   *  ou a une SECTION seule (contenu multi-cours « toute la section », V13). */
  sectionId?: number;
  sectionName?: string;
  courseId?: number;
  courseName?: string;
}

export interface GradeResult {
  score: number;
  total: number;
  /** Per-question right/wrong. */
  correct: boolean[];
  /** Per-question display text of the correct answer (for the review screen). */
  correctAnswers: string[];
  /** Per-question author explanation (null when none) — review screen only. */
  explanations: (string | null)[];
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
  return { id: uid(), type: 'mcq', question: '', choices: ['', ''], answer: 0, openAnswer: '' };
}

export function newQuiz(title: string, now: number = Date.now()): Quiz {
  return { id: uid(), title: title.trim() || 'Quiz', questions: [newQuestion()], createdAt: now };
}

/** Case/space-insensitive comparison key for open answers — mirrors the backend. */
function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

// ── Grading (client-side, for ephemeral / local play) ────────────────────────

/**
 * Grade a finished play. `answers[i]` is the player's answer to question i as a string (the chosen
 * 0-based index for an MCQ, the typed text for an open question); null = skipped. Mirrors the server.
 */
export function gradeQuiz(quiz: Quiz, answers: (string | null)[]): GradeResult {
  const correct: boolean[] = [];
  const correctAnswers: string[] = [];
  const explanations: (string | null)[] = [];
  let score = 0;
  quiz.questions.forEach((q, i) => {
    const given = answers[i];
    let ok: boolean;
    let display: string;
    if (q.type === 'open') {
      display = q.openAnswer;
      ok = given != null && normalizeText(given) === normalizeText(q.openAnswer);
    } else {
      display = q.choices[q.answer] ?? '';
      ok = given != null && given !== '' && Number(given) === q.answer;
    }
    if (ok) score++;
    correct.push(ok);
    correctAnswers.push(display);
    explanations.push(q.explanation?.trim() ? q.explanation.trim() : null);
  });
  return { score, total: quiz.questions.length, correct, correctAnswers, explanations };
}

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * Returns an i18n error key if the quiz can't be published/shared, else null. Mirrors the backend
 * rules so the UI fails fast before a round-trip.
 */
export function validateQuiz(quiz: Quiz): string | null {
  if (!quiz.title.trim()) return 'errTitle';
  if (quiz.questions.length === 0) return 'errNoQuestions';
  for (const q of quiz.questions) {
    if (!q.question.trim()) return 'errQuestionText';
    if (q.type === 'open') {
      if (!q.openAnswer.trim()) return 'errOpenAnswer';
    } else {
      const filled = q.choices.map((c) => c.trim()).filter(Boolean);
      if (filled.length < MIN_CHOICES) return 'errChoices';
      if (q.answer < 0 || q.answer >= q.choices.length || !q.choices[q.answer]?.trim()) return 'errAnswer';
    }
  }
  return null;
}

/** Trim, drop blank MCQ choices (keeping the answer on the right one), clear the unused branch. */
export function normalizeQuiz(quiz: Quiz): Quiz {
  return {
    ...quiz,
    title: quiz.title.trim(),
    questions: quiz.questions.map((q) => {
      const base: QuizQuestion = {
        ...q,
        question: q.question.trim(),
        code: q.code?.trim() ? q.code.trim() : undefined,
        language: q.language?.trim() ? q.language.trim() : undefined,
        explanation: q.explanation?.trim() ? q.explanation.trim() : undefined,
      };
      if (q.type === 'open') {
        return { ...base, openAnswer: q.openAnswer.trim(), choices: [], answer: 0 };
      }
      const correct = q.choices[q.answer];
      const choices = q.choices.map((c) => c.trim()).filter(Boolean);
      const answer = Math.max(0, choices.indexOf((correct ?? '').trim()));
      return { ...base, choices, answer, openAnswer: '' };
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
    serverId: Number.isFinite(q.serverId) ? (q.serverId as number) : undefined,
    published: typeof q.published === 'boolean' ? q.published : undefined,
    sectionId: Number.isFinite(q.sectionId) ? (q.sectionId as number) : undefined,
    sectionName: typeof q.sectionName === 'string' ? q.sectionName : undefined,
    courseId: Number.isFinite(q.courseId) ? (q.courseId as number) : undefined,
    courseName: typeof q.courseName === 'string' ? q.courseName : undefined,
    questions: q.questions.map(healQuestion),
  };
}

function healQuestion(input: unknown): QuizQuestion {
  const q = input as Partial<QuizQuestion>;
  const type: QuestionType = q.type === 'open' ? 'open' : 'mcq';
  const choices = Array.isArray(q.choices) ? q.choices.map((c) => String(c)) : ['', ''];
  const answer = Number.isInteger(q.answer) ? (q.answer as number) : 0;
  return {
    id: typeof q.id === 'string' ? q.id : uid(),
    type,
    question: typeof q.question === 'string' ? q.question : '',
    choices,
    answer: answer >= 0 && answer < choices.length ? answer : 0,
    openAnswer: typeof q.openAnswer === 'string' ? q.openAnswer : '',
    image: typeof q.image === 'string' ? q.image : undefined,
    code: typeof q.code === 'string' ? q.code : undefined,
    language: typeof q.language === 'string' ? q.language : undefined,
    explanation: typeof q.explanation === 'string' ? q.explanation : undefined,
  };
}

// ── Ephemeral URL sharing (no backend) ───────────────────────────────────────
//
// A quiz is packed into a compact shape, JSON-encoded, then base64url-encoded so it rides in the URL
// hash. Anyone (even logged-out) can open the link and play 100% client-side. IMAGES ARE DROPPED from
// the share payload (a base64 image would blow up the URL) — so a shared/anonymous quiz never has
// images, by design. The answers ARE present (a curious player could decode them), fine for a casual
// shared quiz with no score stakes.

interface CompactQ {
  t: QuestionType;
  q: string;
  c?: string[];
  a?: number;
  o?: string;
  code?: string;
  lang?: string;
  /** Explication (courte) — voyage dans le lien pour que la review reste utile. */
  e?: string;
}
interface CompactQuiz {
  t: string;
  q: CompactQ[];
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
    q: n.questions.map((q) => {
      const extra = {
        ...(q.code ? { code: q.code, lang: q.language } : {}),
        ...(q.explanation ? { e: q.explanation } : {}),
      };
      return q.type === 'open'
        ? { t: 'open' as const, q: q.question, o: q.openAnswer, ...extra }
        : { t: 'mcq' as const, q: q.question, c: q.choices, a: q.answer, ...extra };
    }),
  };
  return toBase64Url(JSON.stringify(compact));
}

/** Decode a shared quiz back into a playable Quiz (fresh ids, no images). Throws on malformed input. */
export function decodeQuiz(encoded: string, now: number = Date.now()): Quiz {
  const parsed = JSON.parse(fromBase64Url(encoded)) as CompactQuiz;
  if (typeof parsed.t !== 'string' || !Array.isArray(parsed.q) || parsed.q.length === 0) {
    throw new Error('Invalid shared quiz');
  }
  return {
    id: uid(),
    title: parsed.t,
    createdAt: now,
    questions: parsed.q.map((cq) => {
      if (typeof cq.q !== 'string') throw new Error('Invalid shared question');
      const code = typeof cq.code === 'string' ? cq.code : undefined;
      const language = typeof cq.lang === 'string' ? cq.lang : undefined;
      const explanation = typeof cq.e === 'string' ? cq.e : undefined;
      if (cq.t === 'open') {
        if (typeof cq.o !== 'string') throw new Error('Invalid open question');
        return { id: uid(), type: 'open', question: cq.q, choices: [], answer: 0, openAnswer: cq.o, code, language, explanation };
      }
      if (!Array.isArray(cq.c) || cq.c.length < MIN_CHOICES) throw new Error('Invalid mcq question');
      const choices = cq.c.map((c) => String(c));
      const answer = Number.isInteger(cq.a) && cq.a! >= 0 && cq.a! < choices.length ? cq.a! : 0;
      return { id: uid(), type: 'mcq', question: cq.q, choices, answer, openAnswer: '', code, language, explanation };
    }),
  };
}
