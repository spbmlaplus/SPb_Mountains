import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  base: process.env.VITE_BASE_PATH ?? "/SPb_Mountains/",
  define: {
    'process.env': {},
  },
  // Source CSV/photos/xlsx under new_* are not part of the Vite graph; watching
  // them on Windows often throws EBUSY when files are open elsewhere and kills dev.
  server: {
    watch: {
      ignored: ['**/new_files/**', '**/new_legend/**'],
    },
  },
})
