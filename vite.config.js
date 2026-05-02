import { defineConfig, loadEnv } from 'vite';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const gameData = require('./data/game.json');

// Stub for optional runtime-only dependency that is not installed in dev/test.
const stubStemBridgePlugin = {
  name: 'stub-stem-assistant-bridge',
  resolveId(id) {
    if (id === 'stem-assistant-bridge') return '\0stub:stem-assistant-bridge';
  },
  load(id) {
    if (id === '\0stub:stem-assistant-bridge') {
      return `
        export function initStemAssistantBridge() {}
        export function setStemAssistantLevel() {}
        export const stemAssistant = { levelStart() {}, correct() {}, incorrect() {} };
        export default {};
      `;
    }
  }
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode || 'test', process.cwd(), '');

  return {
    base: `/staticGames/${gameData['game-id']}/`,
    plugins: [stubStemBridgePlugin],
    server: {
      proxy: {
        '/api': 'http://localhost:3000'
      }
    },
    test: {
      globals: true,
      environment: 'node',
      env: {
        VITE_OPENAI_API_KEY: env.VITE_OPENAI_API_KEY,
      },
    },
  };
});
