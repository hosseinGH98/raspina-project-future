import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'public_html',
      emptyOutDir: true,
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: env.DISABLE_HMR !== 'true',
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
    },
  };
});
