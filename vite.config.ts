import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  base: './',
  server: {
    host: '0.0.0.0'
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: undefined // Prevent code splitting issues
      }
    },
    // Ensure assets use relative paths
    assetsDir: 'assets',
    // Generate sourcemaps for debugging production issues
    sourcemap: true,
    // Minify but keep readable for debugging
    minify: 'esbuild',
  }
})
