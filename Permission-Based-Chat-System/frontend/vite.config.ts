import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https configuration
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // Adjust if your React app is running on a different port
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.message.includes('"use client"')) return
        warn(warning)
      }
    }
  }
});
