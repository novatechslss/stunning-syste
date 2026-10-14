import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Plain `vite` serves only the frontend. Use `vercel dev` to run /api locally.
  server: { proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: false } } },
  test: { environment: 'node', include: ['tests/**/*.test.{js,jsx}'], globals: true }
});
