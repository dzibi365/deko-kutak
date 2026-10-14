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
      // three-vendor (1,173 kB) and tiptap-vendor (445 kB) are intentional
      // deferred chunks — suppress the noise for them.
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks: {
            // React core — very stable; cached independently from app code.
            'react-vendor': ['react', 'react-dom'],
            // Supabase client — large and changes infrequently.
            'supabase-vendor': ['@supabase/supabase-js'],
            // Framer Motion — used only in ProductDetail lightbox; isolate for
            // caching so any app-code deploy doesn't bust the motion cache.
            'motion-vendor': ['motion'],
            // Three.js stack — referenced by ThreeDPreviewModal (storefront,
            // lazy) and MeshPickerCanvas (admin ProductForm, lazy).  One shared
            // chunk is cached after the first 3D preview or admin visit.
            'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
            // TipTap — referenced by RichTextEditor used in admin Products and
            // admin Pages.  Both are lazy-loaded admin routes.
            'tiptap-vendor': [
              '@tiptap/react',
              '@tiptap/starter-kit',
              '@tiptap/extension-image',
              '@tiptap/extension-youtube',
              '@tiptap/extension-link',
              '@tiptap/extension-placeholder',
              '@tiptap/extension-text-style',
              '@tiptap/extension-color',
            ],
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
