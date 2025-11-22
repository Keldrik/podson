import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  target: 'es2020',
  outDir: 'dist',
  // Keep external dependencies external (not bundled)
  external: ['got', 'sax', 'lodash'],
  // Preserve modules for better tree-shaking
  shims: false,
  // Generate both index.js (CJS) and index.mjs (ESM)
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.mjs',
    };
  },
});
