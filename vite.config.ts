import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, './src/renderer'),
      '@main': path.resolve(__dirname, './src/main'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@components': path.resolve(__dirname, './src/renderer/shared/components'),
      '@hooks': path.resolve(__dirname, './src/renderer/shared/hooks'),
      '@lib': path.resolve(__dirname, './src/renderer/shared/lib'),
      '@pages': path.resolve(__dirname, './src/renderer/pages')
    }
  },
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
