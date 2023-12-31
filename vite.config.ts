import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: 'docs',
  },
  server: {
    proxy: {
      '/proxy': {
        target: 'https://hachyderm.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy/, ''),
      }
    }
  },
  base: '/hashtodon/',
})
