/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // относительные пути — работает на GitHub Pages в подкаталоге репозитория
  base: './',
  plugins: [svelte()],
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
  },
})
