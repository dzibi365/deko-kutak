import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "robots-meta",
        transformIndexHtml(html: string): string {
          if (process.env.VITE_ALLOW_INDEXING === "true") {
            return html.replace(
              '<meta name="robots" content="noindex,nofollow" />',
              '<meta name="robots" content="index,follow" />',
            );
          }
          return html;
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Three.js lazy chunk (~1,000 kB) and TipTap admin chunk (~115 kB) are
      // intentionally large deferred chunks — suppress warning for them.
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks: {
            // Supabase and Motion are legitimately part of the initial load
            // (supabase is used by contexts; motion is used by ProductDetail
            // lightbox).  Splitting them into named files lets the browser
            // cache these stable libraries independently from app code.
            // NOTE: do NOT add tiptap or three here — Rollup would absorb
            // React / __vite__preload into those chunks, turning them into
            // static (eager) imports and defeating the lazy-loading.
            'supabase-vendor': ['@supabase/supabase-js'],
            'motion-vendor': ['motion'],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
