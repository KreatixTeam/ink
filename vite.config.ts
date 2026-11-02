import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const target = process.env.JMAP_TARGET ?? 'https://mail.kreatix.dev'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    proxy: {
      '/jmap': { target, changeOrigin: true, secure: true },
      '/.well-known/jmap': { target, changeOrigin: true, secure: true },
    },
  },
})
