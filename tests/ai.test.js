import { describe, test, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// Parse .env manually — no extra dependency needed
function loadEnvKey(key) {
  const raw = readFileSync(resolve(ROOT, '.env'), 'utf-8');
  const match = raw.match(new RegExp(`^${key}=(.+)$`, 'm'));
  return match?.[1]?.trim();
}

const API_KEY = process.env.VITE_OPENAI_API_KEY ?? loadEnvKey('VITE_OPENAI_API_KEY');

describe('AI API Key & Generation', () => {
  test('VITE_OPENAI_API_KEY is defined in .env', () => {
    expect(API_KEY).toBeDefined();
    expect(API_KEY.length).toBeGreaterThan(10);
  });

  test('API key has the expected sk- prefix', () => {
    expect(API_KEY).toMatch(/^sk-/);
  });

  test('game uses callAI in script.js', () => {
    const script = readFileSync(resolve(ROOT, 'public/script.js'), 'utf-8');
    expect(script).toContain('callAI');
  });

  test('ai.js defines the callAI function', () => {
    const ai = readFileSync(resolve(ROOT, 'public/ai.js'), 'utf-8');
    expect(ai).toContain('function callAI');
  });

  test('ai.js sends requests to the backend /api/ai/openai route', () => {
    const ai = readFileSync(resolve(ROOT, 'public/ai.js'), 'utf-8');
    expect(ai).toContain('/api/ai/openai');
  });
});

// Make one shared API call so both response tests below reuse it
describe('AI Live Response', () => {
  let responseData;

  beforeAll(async () => {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Reply with only valid JSON: {"status":"ok"}' }],
        max_tokens: 20,
      }),
    });
    responseData = await res.json();
  }, 20_000);

  test('API call succeeds and returns choices', () => {
    expect(responseData).toHaveProperty('choices');
    expect(responseData.choices.length).toBeGreaterThan(0);
    expect(responseData.choices[0].message).toHaveProperty('content');
  });

  test('AI response content is parseable JSON', () => {
    const content = responseData.choices[0].message.content;
    expect(() => JSON.parse(content)).not.toThrow();
  });
});
