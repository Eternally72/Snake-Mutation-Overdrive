import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // relative base so the build works under any static host path (e.g. GitHub Pages /Snake-Mutation-Overdrive/)
  base: './',
  plugins: [react()],
});
