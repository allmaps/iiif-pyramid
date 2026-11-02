import tailwindcss from '@tailwindcss/vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import { sveltePhosphorOptimize } from 'phosphor-svelte/vite'

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), sveltePhosphorOptimize()],
  optimizeDeps: { include: ['@allmaps/render/webgl2'] },
  server: {
    strictPort: true,
    allowedHosts: [
      '.ngrok-free.dev',
      '.ngrok-free.app',
      '.ngrok.app',
      '.ngrok.io'
    ]
  },
  worker: { format: 'es' }
})
