import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: "/weedpriority/",
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/inat-photos': {
        target: 'https://inaturalist-open-data.s3.amazonaws.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/inat-photos/, ''),
      },
      '/inat-static': {
        target: 'https://static.inaturalist.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/inat-static/, ''),
      },
    },
  },
})
