import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Using custom domain safarigam.com
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
