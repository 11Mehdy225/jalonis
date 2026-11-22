import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, strictPort: true },
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if(!id.includes('node_modules'))return undefined
          if(id.includes('/react/')||id.includes('/react-dom/'))return 'react'
          if(id.includes('/@supabase/'))return 'supabase'
          if(id.includes('/lucide-react/'))return 'icons'
          return 'vendor'
        },
      },
    },
  },
})
