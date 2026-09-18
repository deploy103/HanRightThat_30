import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const API_TARGET = process.env.API_TARGET ?? 'http://127.0.0.1:8787';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
    // WSL에서 /mnt/c/... 처럼 Windows 드라이브를 마운트한 경로는 inotify 이벤트가 오지 않아
    // 파일을 고쳐도 HMR이 반영되지 않는 경우가 있다 — 폴링으로 우회한다.
    watch: { usePolling: true },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'shared/**/*.test.ts'],
  },
});
