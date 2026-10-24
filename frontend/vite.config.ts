/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    // '@/shared/...'처럼 src 기준으로 import한다(tsconfig.app.json paths와 같게)
    alias: { '@': '/src' },
  },
  server: {
    port: 5173,
  },
  test: {
    // tokens.test.ts가 토큰 파일을 글자 그대로(?raw) 읽는다. 다른 CSS는 테스트에서 비워 둔다
    css: { include: [/tokens\.css/] },
  },
})
