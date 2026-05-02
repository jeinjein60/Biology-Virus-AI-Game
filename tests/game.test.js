import { describe, test, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

describe('Game Runs', () => {
  test('index.html exists', () => {
    expect(existsSync(resolve(ROOT, 'index.html'))).toBe(true);
  });

  test('game script (script.js) exists', () => {
    expect(existsSync(resolve(ROOT, 'public/script.js'))).toBe(true);
  });

  test('AI layer (ai.js) exists', () => {
    expect(existsSync(resolve(ROOT, 'public/ai.js'))).toBe(true);
  });

  test('game data JSON is valid and has a game-id', () => {
    const raw = readFileSync(resolve(ROOT, 'data/game.json'), 'utf-8');
    const data = JSON.parse(raw);
    expect(data).toHaveProperty('game-id');
  });

  test('script.js is non-empty', () => {
    const content = readFileSync(resolve(ROOT, 'public/script.js'), 'utf-8');
    expect(content.length).toBeGreaterThan(0);
  });

  test('ai.js is non-empty', () => {
    const content = readFileSync(resolve(ROOT, 'public/ai.js'), 'utf-8');
    expect(content.length).toBeGreaterThan(0);
  });

  test('index.html references script.js', () => {
    const html = readFileSync(resolve(ROOT, 'index.html'), 'utf-8');
    expect(html).toContain('script.js');
  });

  test('script.js imports from ai.js', () => {
    const script = readFileSync(resolve(ROOT, 'public/script.js'), 'utf-8');
    expect(script).toContain("from './ai.js'");
  });

  test('script.js defines startGame', () => {
    const script = readFileSync(resolve(ROOT, 'public/script.js'), 'utf-8');
    expect(script).toContain('function startGame');
  });

  test('script.js defines loadQuestion', () => {
    const script = readFileSync(resolve(ROOT, 'public/script.js'), 'utf-8');
    expect(script).toContain('function loadQuestion');
  });

  test('script.js defines getFeedback', () => {
    const script = readFileSync(resolve(ROOT, 'public/script.js'), 'utf-8');
    expect(script).toContain('function getFeedback');
  });

  test('script.js defines showGameOver', () => {
    const script = readFileSync(resolve(ROOT, 'public/script.js'), 'utf-8');
    expect(script).toContain('function showGameOver');
  });

  test('script.js defines restartGame', () => {
    const script = readFileSync(resolve(ROOT, 'public/script.js'), 'utf-8');
    expect(script).toContain('function restartGame');
  });
});
