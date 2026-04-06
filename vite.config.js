import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: '/',
    define: {
      __OPENAI_API_KEY__: JSON.stringify(env.VITE_OPENAI_API_KEY),
    },
  };
});
