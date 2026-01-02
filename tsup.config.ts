import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    noshiro: 'src/index.ts',
  },
  format: ['cjs', 'esm'],
  outDir: 'dist',
  clean: true,
  minify: true,
  sourcemap: true,
  dts: true,
  splitting: false,
  target: 'es2022',
  platform: 'node',
});
