import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/Formations/',  // must match the repo name exactly (case-sensitive)
  plugins: [react()]
})
