
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // base: './' permet de générer des chemins relatifs dans le build final
  // indispensable pour GitHub Pages qui utilise des sous-dossiers
  base: './',
  define: {
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
    'process.env': {} 
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'lucide-react', 'recharts'],
        },
      },
    },
  },
});
