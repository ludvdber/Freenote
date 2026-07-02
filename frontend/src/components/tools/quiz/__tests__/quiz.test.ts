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
      { id: 'a', type: 'mcq', question: 'Couche transport ?', choices: ['UDP', 'TCP'], answer: 1, openAnswer: '' },
      { id: 'b', type: 'mcq', question: 'Protocole de résolution ?', choices: ['ARP', 'IP', 'HTTP'], answer: 0, openAnswer: '' },
    ],
    ...overrides,
  };
}

describe('quiz — grading', () => {
  it('counts the correct chosen answers (index as string), skipping null', () => {
    expect(gradeQuiz(quiz(), ['1', '0']).score).toBe(2);
    expect(gradeQuiz(quiz(), ['0', '0']).score).toBe(1);
    expect(gradeQuiz(quiz(), [null, null]).score).toBe(0);
  });

  it('returns per-question correctness and the correct-answer display text', () => {
    const res = gradeQuiz(quiz(), ['0', '0']);
    expect(res.correct).toEqual([false, true]);
    expect(res.correctAnswers).toEqual(['TCP', 'ARP']);
  });

  it('grades an open question case/space-insensitively', () => {
    const q = quiz({ questions: [{ id: 'a', type: 'open', question: '2+2 ?', choices: [], answer: 0, openAnswer: '4' }] });
    expect(gradeQuiz(q, ['  4 ']).correct).toEqual([true]);
    expect(gradeQuiz(q, ['5']).correct).toEqual([false]);
    expect(gradeQuiz(q, [null]).score).toBe(0);
  });
});

describe('quiz — validation', () => {
  it('accepts a well-formed quiz', () => {
    expect(validateQuiz(quiz())).toBeNull();
  });

  it('rejects a blank title', () => {
    expect(validateQuiz(quiz({ title: '   ' }))).toBe('errTitle');
  });

  it('rejects an MCQ with fewer than two filled choices', () => {
    const bad = quiz({ questions: [{ id: 'a', type: 'mcq', question: 'Q', choices: ['only', ''], answer: 0, openAnswer: '' }] });
    expect(validateQuiz(bad)).toBe('errChoices');
  });

  it('rejects an MCQ whose correct choice is blank', () => {
    const bad = quiz({ questions: [{ id: 'a', type: 'mcq', question: 'Q', choices: ['x', 'y', ''], answer: 2, openAnswer: '' }] });
    expect(validateQuiz(bad)).toBe('errAnswer');
  });

  it('rejects an open question without an expected answer', () => {
    const bad = quiz({ questions: [{ id: 'a', type: 'open', question: 'Q', choices: [], answer: 0, openAnswer: '  ' }] });
    expect(validateQuiz(bad)).toBe('errOpenAnswer');
  });
});

describe('quiz — normalize', () => {
  it('trims, drops blank MCQ choices and keeps the answer on the right choice', () => {
    const n = normalizeQuiz(quiz({
      questions: [{ id: 'a', type: 'mcq', question: '  Q  ', choices: ['  A  ', '', '  B  '], answer: 2, openAnswer: '' }],
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
    expect(healed[0].questions[0].type).toBe('mcq');
    expect(healed[0].questions[0].openAnswer).toBe('');
  });

  it('throws on malformed backups', () => {
    expect(() => quizzesFromJson('not json')).toThrow();
    expect(() => quizzesFromJson('{"quizzes":[{"questions":[]}]}')).toThrow();
  });
});

describe('quiz — ephemeral URL sharing', () => {
  it('round-trips mcq + open through encode/decode, with fresh ids', () => {
    const q = quiz({
      questions: [
        { id: 'a', type: 'mcq', question: 'Q1', choices: ['x', 'y'], answer: 1, openAnswer: '' },
        { id: 'b', type: 'open', question: 'Q2', choices: [], answer: 0, openAnswer: '42' },
      ],
    });
    const encoded = encodeQuiz(q);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/); // base64url, no padding
    const decoded = decodeQuiz(encoded, NOW);
    expect(decoded.questions[0].type).toBe('mcq');
    expect(decoded.questions[0].answer).toBe(1);
    expect(decoded.questions[1].type).toBe('open');
    expect(decoded.questions[1].openAnswer).toBe('42');
    expect(decoded.questions[0].id).not.toBe('a'); // regenerated
  });

  it('drops images from the share payload (no images for anonymous players)', () => {
    const q = quiz({
      questions: [{ id: 'a', type: 'mcq', question: 'Q', choices: ['x', 'y'], answer: 0, openAnswer: '', image: 'data:image/png;base64,AAAA' }],
    });
    expect(decodeQuiz(encodeQuiz(q)).questions[0].image).toBeUndefined();
  });

  it('throws on a garbage payload', () => {
    expect(() => decodeQuiz('!!!not-base64!!!')).toThrow();
  });

  it('creates a starter quiz with one empty MCQ question', () => {
    const q = newQuiz('Mon quiz', NOW);
    expect(q.title).toBe('Mon quiz');
    expect(q.questions).toHaveLength(1);
    expect(q.questions[0].type).toBe('mcq');
    expect(q.questions[0].choices).toHaveLength(2);
  });
});
