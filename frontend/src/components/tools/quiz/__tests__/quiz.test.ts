import { describe, it, expect } from 'vitest';
import {
  newQuiz, gradeQuiz, validateQuiz, normalizeQuiz,
  quizzesToJson, quizzesFromJson, encodeQuiz, decodeQuiz,
} from '../logic';
import type { Quiz } from '../logic';

const NOW = 1_700_000_000_000;

function quiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: 'q1',
    title: 'Réseaux',
    createdAt: NOW,
    questions: [
      { id: 'a', question: 'Couche transport ?', choices: ['UDP', 'TCP'], answer: 1 },
      { id: 'b', question: 'Protocole de résolution ?', choices: ['ARP', 'IP', 'HTTP'], answer: 0 },
    ],
    ...overrides,
  };
}

describe('quiz — grading', () => {
  it('counts only the correct chosen answers, skipping null', () => {
    expect(gradeQuiz(quiz(), [1, 0])).toEqual({ score: 2, total: 2 });
    expect(gradeQuiz(quiz(), [0, 0])).toEqual({ score: 1, total: 2 });
    expect(gradeQuiz(quiz(), [null, null])).toEqual({ score: 0, total: 2 });
  });
});

describe('quiz — validation', () => {
  it('accepts a well-formed quiz', () => {
    expect(validateQuiz(quiz())).toBeNull();
  });

  it('rejects a blank title', () => {
    expect(validateQuiz(quiz({ title: '   ' }))).toBe('errTitle');
  });

  it('rejects a question with fewer than two filled choices', () => {
    const bad = quiz({ questions: [{ id: 'a', question: 'Q', choices: ['only', ''], answer: 0 }] });
    expect(validateQuiz(bad)).toBe('errChoices');
  });

  it('rejects when the correct choice points at a blank entry', () => {
    const bad = quiz({ questions: [{ id: 'a', question: 'Q', choices: ['x', 'y', ''], answer: 2 }] });
    expect(validateQuiz(bad)).toBe('errAnswer');
  });
});

describe('quiz — normalize', () => {
  it('trims, drops blank choices and keeps the answer on the right choice', () => {
    const n = normalizeQuiz(quiz({
      questions: [{ id: 'a', question: '  Q  ', choices: ['  A  ', '', '  B  '], answer: 2 }],
    }));
    expect(n.questions[0].choices).toEqual(['A', 'B']);
    expect(n.questions[0].answer).toBe(1); // B was index 2, now index 1
    expect(n.questions[0].question).toBe('Q');
  });
});

describe('quiz — localStorage backup', () => {
  it('round-trips through JSON and heals missing fields', () => {
    const restored = quizzesFromJson(quizzesToJson([quiz()]));
    expect(restored).toHaveLength(1);
    expect(restored[0].title).toBe('Réseaux');
    expect(restored[0].questions[1].answer).toBe(0);

    const healed = quizzesFromJson('{"quizzes":[{"title":"x","questions":[{"question":"q","choices":["a","b"]}]}]}', NOW);
    expect(healed[0].questions[0].answer).toBe(0);
    expect(healed[0].createdAt).toBe(NOW);
  });

  it('throws on malformed backups', () => {
    expect(() => quizzesFromJson('not json')).toThrow();
    expect(() => quizzesFromJson('{"quizzes":[{"questions":[]}]}')).toThrow();
  });
});

describe('quiz — ephemeral URL sharing', () => {
  it('round-trips a quiz through encode/decode (UTF-8 safe), with fresh ids', () => {
    const encoded = encodeQuiz(quiz());
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, no padding
    const decoded = decodeQuiz(encoded, NOW);
    expect(decoded.title).toBe('Réseaux');
    expect(decoded.questions).toHaveLength(2);
    expect(decoded.questions[0].choices).toEqual(['UDP', 'TCP']);
    expect(decoded.questions[0].answer).toBe(1);
    expect(decoded.questions[0].id).not.toBe('a'); // regenerated
  });

  it('throws on a garbage payload', () => {
    expect(() => decodeQuiz('!!!not-base64!!!')).toThrow();
  });

  it('creates a starter quiz with one empty question', () => {
    const q = newQuiz('Mon quiz', NOW);
    expect(q.title).toBe('Mon quiz');
    expect(q.questions).toHaveLength(1);
    expect(q.questions[0].choices).toHaveLength(2);
  });
});
