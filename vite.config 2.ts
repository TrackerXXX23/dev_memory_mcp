import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      '@modelcontextprotocol/sdk': '@modelcontextprotocol/sdk/dist',
    },
  },
  optimizeDeps: {
    include: ['@modelcontextprotocol/sdk/dist/server/index.js'],
  },
});
