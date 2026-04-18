import { describe, test, expect } from 'vitest';
import { existsSync, statSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const PUBLIC_ASSETS = [
  'public/bg.png',
  'public/game-main-box.png',
  'public/info-panel.png',
  'public/redV.png',
  'public/rotateIcon.png',
];

// Data assets that aren't directly referenced in index.html but are still crucial for the game
const DATA_ASSETS = [
  'data/thumbnail.png',
];

const ALL_ASSETS = [...PUBLIC_ASSETS, ...DATA_ASSETS];
const html = readFileSync(resolve(ROOT, 'index.html'), 'utf-8');

describe('Image Assets', () => {
  for (const assetPath of ALL_ASSETS) {
    test(`${assetPath} exists on disk`, () => {
      expect(existsSync(resolve(ROOT, assetPath))).toBe(true);
    });

    test(`${assetPath} is not an empty file`, () => {
      const { size } = statSync(resolve(ROOT, assetPath));
      expect(size).toBeGreaterThan(0);
    });
  }
  for (const assetPath of PUBLIC_ASSETS) {
    const filename = assetPath.split('/').pop();
    test(`${filename} is referenced in index.html`, () => {
      expect(html).toContain(filename);
    });
  }
});
