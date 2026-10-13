import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Built files go to /static so they never clash with the /assets page route.
  build: { assetsDir: 'static' },
  server: {
    port: 3000,
    // In development the API runs separately; proxy /api so the browser
    // only ever talks to one origin, like it does behind nginx in Docker.
    proxy: {
      '/api': process.env.VITE_API_PROXY || 'http://localhost:5060',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
});
