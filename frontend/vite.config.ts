import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // base: './', // 👈 Important for Wails: relative paths for assets
  // build: {
  //   target: 'es2020', // Wails uses a modern Edge/Chromium engine
  //   minify: 'esbuild', // Much faster than terser, just as small
  //   cssMinify: true,
  //   sourcemap: false, // Usually unnecessary for prod
  //   brotliSize: false, // Speeds up builds
  //   esbuild: {
  //     drop: ['console', 'debugger'], // Clean console/debugger calls
  //     legalComments: 'none',
  //   },
  //   rollupOptions: {
  //     // Let Vite handle chunking
  //     output: {
  //       manualChunks: undefined,
  //     },
  //   },
  //   // Optional: if you’re embedding large assets, increase the inline limit
  //   // assetsInlineLimit: 4096,
  // },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
