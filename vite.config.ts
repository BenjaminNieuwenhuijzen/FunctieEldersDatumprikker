/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages projectsite: https://benjaminnieuwenhuijzen.github.io/FunctieEldersDatumprikker/
// Bij een custom domein later: base op '/' zetten (of VITE_BASE_PATH in de workflow).
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/FunctieEldersDatumprikker/',
  plugins: [react(), tailwindcss()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
