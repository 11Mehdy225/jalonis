import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (mode === 'production' && (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY)) {
    throw new Error('Configuration Supabase absente : le déploiement est interrompu pour éviter de publier une connexion inactive.')
  }

  return {
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
  }
})
