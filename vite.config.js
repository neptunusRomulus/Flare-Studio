import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      }
    }
  },
  server: {
<<<<<<< HEAD
    port: 5175
=======
    port: 5173
>>>>>>> 7bd82e7 (typescript transfer succelfully finished.)
  },
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
