// Used by `npm run build` (the static frontend Vercel serves). The dev server ignores this file:
// server/index.mjs configures Vite inline with `configFile: false`.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' }
})
