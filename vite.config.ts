import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build can be hosted from any sub-folder.
  base: './',
  // Expose the dev server on the local network so you can open it on your phone.
  server: { host: true },
  preview: { host: true },
  // The background-removal worker loads its model runtime with dynamic imports, which need ES module workers.
  worker: { format: 'es' },
})
