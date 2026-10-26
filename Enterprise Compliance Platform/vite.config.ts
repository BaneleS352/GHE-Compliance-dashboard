import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const apiProxyTarget = process.env.E2E_API_URL || 'http://localhost:3001'
const testProviderProxyTarget = process.env.E2E_JWKS_URL || 'http://127.0.0.1:55439'

function AssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return fileURLToPath(new URL(`./src/assets/${filename}`, import.meta.url))
      }
    },
  }
}

export default defineConfig({
  plugins: [
    AssetResolver(),
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      "/api": { target: apiProxyTarget, changeOrigin: true },
      "/__dev-auth": {
        target: testProviderProxyTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__dev-auth/, ""),
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts'],
          excel: ['xlsx'],
          motion: ['framer-motion'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
