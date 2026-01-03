import { defineConfig } from 'vite';
import * as path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      WebSdk: path.resolve(__dirname, 'src/websdk.ts'),
    },
  },
  optimizeDeps: {
    // evita que Vite quiera pre-optimizar ese “módulo”
    exclude: ['WebSdk'],
  },
});
