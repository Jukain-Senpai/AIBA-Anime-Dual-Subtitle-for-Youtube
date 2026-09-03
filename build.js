import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

async function runBuild() {
  const rootDir = process.cwd();

  console.log('[Build] Building Popup UI...');
  await build({
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: resolve(rootDir, 'src/popup/index.html'),
        },
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
    },
  });

  console.log('[Build] Building Content Script as standalone IIFE bundle...');
  await build({
    configFile: false,
    build: {
      outDir: 'dist',
      emptyOutDir: false, // Keep popup build intact
      lib: {
        entry: resolve(rootDir, 'src/content/index.ts'),
        name: 'JapaneseDualSubtitleContent',
        formats: ['iife'],
        fileName: () => 'content.js',
      },
    },
  });

  console.log('[Build] Extension build complete!');
}

runBuild().catch((err) => {
  console.error('[Build Failed]', err);
  process.exit(1);
});
