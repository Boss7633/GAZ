
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // On définit explicitement process.env pour éviter les crashs si le code y accède
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
    'process.env': {} 
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
