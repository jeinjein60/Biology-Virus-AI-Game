import { defineConfig, loadEnv } from 'vite';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const gameData = require('./data/game.json');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode || 'test', process.cwd(), '');

  return {
    base: `/staticGames/${gameData['game-id']}/`,
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
