import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In Docker the backend is another service, so VITE_BACKEND_URL points to it.
// Outside Docker the default works (backend on localhost:3000).
const backend = process.env.VITE_BACKEND_URL ?? 'http://localhost:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // the browser talks only to the Vite origin; Vite forwards the API and the WebSocket
      '/api': {
        target: backend,
        changeOrigin: true,
      },
      '/socket.io': {
        target: backend,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
