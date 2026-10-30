import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: '/portfolio_ver1/',
  build: {
    rollupOptions: {
      input: {
        pageTurn: fileURLToPath(new URL('./page-turn.html', import.meta.url)),
        home: fileURLToPath(new URL('./index.html', import.meta.url)),
        book: fileURLToPath(new URL('./book.html', import.meta.url)),
        studio: fileURLToPath(new URL('./studio.html', import.meta.url)),
      },
    },
  },
});
