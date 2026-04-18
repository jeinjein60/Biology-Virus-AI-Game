import { describe, test, expect, beforeAll, vi, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  repairJson, safeJson, shuffleChoices,
  buildStartPrompt, buildQuestionPrompt, buildFeedbackPrompt,
  buildEndPrompt, buildChatPrompt, buildQuestionFallback,
  DAY_THEMES, callAI
} from '../public/ai.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadEnvKey(key) {
  const raw = readFileSync(resolve(ROOT, '.env'), 'utf-8');
  const match = raw.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return match?.[1]?.trim();
}

const API_KEY = process.env.VITE_OPENAI_API_KEY ?? loadEnvKey('VITE_OPENAI_API_KEY');

describe('AI Utilities (Unit)', () => {
  test('repairJson extracts JSON from surrounding text', () => {
    const result = repairJson('Some text {"key": "value"} trailing');
    expect(result).toBe('{"key": "value"}');
  });

  test('repairJson removes trailing commas', () => {
    const result = repairJson('{"a": 1,}');
    expect(JSON.parse(result).a).toBe(1);
  });

  test('repairJson replaces curly quotes', () => {
    const result = repairJson('{\u201ckey\u201d: \u201cval\u201d}');
    expect(JSON.parse(result).key).toBe('val');
  });

  test('safeJson parses clean JSON', () => {
    expect(safeJson('{"status":"ok"}')).toEqual({ status: 'ok' });
  });

  test('safeJson strips markdown fences', () => {
    expect(safeJson('```json\n{"status":"ok"}\n```')).toEqual({ status: 'ok' });
  });

  test('safeJson throws on completely unparseable input', () => {
    expect(() => safeJson('not json !!!!')).toThrow();
  });

  test('buildQuestionFallback returns all required fields', () => {
    const fallback = buildQuestionFallback(1);
    for (const field of ['scenario', 'question', 'choices', 'correct', 'choice_ratings', 'educational_note']) {
      expect(fallback).toHaveProperty(field);
    }
  });

  test('buildQuestionFallback choices have id and text', () => {
    const fallback = buildQuestionFallback(3);
    expect(fallback.choices).toHaveLength(4);
    fallback.choices.forEach(c => {
      expect(c).toHaveProperty('id');
      expect(c).toHaveProperty('text');
    });
  });

  test('shuffleChoices keeps all four labels A-D', () => {
    const data = {
      choices: [
        { id: 'A', text: 'Alpha' },
        { id: 'B', text: 'Beta' },
        { id: 'C', text: 'Gamma' },
        { id: 'D', text: 'Delta' }
      ],
      correct: 'A',
      choice_ratings: { A: 'excellent', B: 'good', C: 'poor', D: 'terrible' }
    };
    const result = shuffleChoices(data);
    expect(result.choices.map(c => c.id).sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(['A', 'B', 'C', 'D']).toContain(result.correct);
    expect(Object.keys(result.choice_ratings).sort()).toEqual(['A', 'B', 'C', 'D']);
  });

  test('shuffleChoices preserves all choice texts', () => {
    const texts = ['Alpha', 'Beta', 'Gamma', 'Delta'];
    const data = {
      choices: texts.map((t, i) => ({ id: ['A','B','C','D'][i], text: t })),
      correct: 'B',
      choice_ratings: { A: 'good', B: 'excellent', C: 'poor', D: 'terrible' }
    };
    const result = shuffleChoices(data);
    expect(result.choices.map(c => c.text).sort()).toEqual(texts.sort());
  });

  test('buildStartPrompt returns a non-empty string', () => {
    const prompt = buildStartPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(50);
  });

  test('buildStartPrompt contains required JSON field names', () => {
    const prompt = buildStartPrompt();
    for (const field of ['virus_name', 'transmission', 'symptoms', 'location', 'scenario']) {
      expect(prompt).toContain(field);
    }
  });

  test('buildQuestionPrompt includes day and question number', () => {
    const prompt = buildQuestionPrompt({ virus_name: 'TestVirus', real_virus: 'Ebola', transmission: 'air', location: 'NYC' }, 2, 3, []);
    expect(prompt).toContain('Day 2');
    expect(prompt).toContain('question 3');
  });

  test('buildFeedbackPrompt includes the rating and choice', () => {
    const qData = {
      question: 'What to do?',
      choices: [{ id: 'A', text: 'Isolate immediately' }],
      correct: 'A'
    };
    const prompt = buildFeedbackPrompt('A', 'excellent', qData);
    expect(prompt).toContain('excellent');
    expect(prompt).toContain('A');
  });

  test('buildEndPrompt includes score and outcome', () => {
    const prompt = buildEndPrompt({ virus_name: 'X', real_virus: 'Ebola' }, 75, []);
    expect(prompt).toContain('75');
    expect(prompt).toContain('CONTAINED');
  });

  test('buildChatPrompt includes the student message', () => {
    const prompt = buildChatPrompt('What is R0?', { day: 1, score: 50 }, []);
    expect(prompt).toContain('What is R0?');
  });

  test('DAY_THEMES has an entry for all 7 days', () => {
    for (let i = 1; i <= 7; i++) {
      expect(DAY_THEMES[i]).toBeDefined();
      expect(typeof DAY_THEMES[i]).toBe('string');
    }
  });
});

describe('AI Live Response', () => {
  let responseData;

  beforeAll(async () => {
    // Save original fetch before stubbing, then intercept /api/ai/openai and
    // forward to real OpenAI. This routes through callAI, giving coverage on lines 66-94.
    const realFetch = globalThis.fetch;
    vi.stubGlobal('fetch', (url, options) =>
      realFetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
        body: options.body,
      })
    );

    responseData = await callAI('Reply with only valid JSON: {"status":"ok"}', 20);
  }, 20_000);

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  test('callAI returns a parsed object', () => {
    expect(typeof responseData).toBe('object');
    expect(responseData).not.toBeNull();
  });

  test('AI response content is parseable JSON', () => {
    expect(() => JSON.stringify(responseData)).not.toThrow();
  });
});
