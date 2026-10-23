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
})
