import { describe, test, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

let html;

beforeAll(() => {
  html = readFileSync(resolve(ROOT, 'index.html'), 'utf-8');
});

describe('All Pages / Screens Load', () => {
  test('landing screen is present', () => {
    expect(html).toContain('id="screen-landing"');
  });

  test('loading screen is present', () => {
    expect(html).toContain('id="screen-loading"');
  });

  test('day-transition screen is present', () => {
    expect(html).toContain('id="screen-day-transition"');
  });

  test('game screen is present', () => {
    expect(html).toContain('id="screen-game"');
  });

  test('game-over screen is present', () => {
    expect(html).toContain('id="screen-game-over"');
  });

  test('briefing modal is present', () => {
    expect(html).toContain('id="briefing-modal"');
  });

  test('feedback modal is present', () => {
    expect(html).toContain('id="feedback-modal"');
  });

  test('all screens use the shared .screen class', () => {
    const matches = html.match(/class="screen/g) ?? [];
    // numeber of pages 
    expect(matches.length).toBeGreaterThanOrEqual(5);
  });

  test('landing screen has a start button', () => {
    // The start button calls startGame via onclick
    expect(html).toContain('startGame');
  });
});
