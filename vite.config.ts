import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy WebSocket connections to game server
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
      // Proxy API endpoints
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/rooms': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
