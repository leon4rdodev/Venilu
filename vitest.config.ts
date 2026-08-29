import { defineConfig } from 'vitest/config';
import path from 'path';
import swc from 'unplugin-swc';

const aliases = {
  '@renderer': path.resolve(__dirname, './src/renderer'),
  '@main': path.resolve(__dirname, './src/main'),
  '@shared': path.resolve(__dirname, './src/shared'),
  '@components': path.resolve(__dirname, './src/renderer/shared/components'),
  '@hooks': path.resolve(__dirname, './src/renderer/shared/hooks'),
  '@lib': path.resolve(__dirname, './src/renderer/shared/lib'),
  '@pages': path.resolve(__dirname, './src/renderer/pages'),
};

export default defineConfig({
  test: {
    projects: [
      {
        // Backend: TypeORM services under Node with electron stubbed.
        // SWC transform emits decorator metadata (esbuild can't), which
        // TypeORM entities rely on for column type inference.
        plugins: [
          swc.vite({
            jsc: {
              parser: { syntax: 'typescript', decorators: true },
              transform: { legacyDecorator: true, decoratorMetadata: true },
              target: 'es2022',
            },
            module: { type: 'es6' },
          }),
        ],
        resolve: {
          alias: {
            ...aliases,
            electron: path.resolve(__dirname, './src/test/mocks/electron.ts'),
          },
        },
        test: {
          name: 'main',
          environment: 'node',
          include: ['src/main/**/*.test.ts', 'src/shared/**/*.test.ts'],
          setupFiles: ['reflect-metadata'],
          testTimeout: 20000,
          hookTimeout: 20000,
        },
      },
      {
        // Renderer: components and hooks under jsdom.
        resolve: { alias: aliases },
        test: {
          name: 'renderer',
          environment: 'jsdom',
          // globals: RTL registers its afterEach auto-cleanup only when the
          // vitest globals are present.
          globals: true,
          include: ['src/renderer/**/*.test.{ts,tsx}', 'src/test/renderer/**/*.test.{ts,tsx}'],
          setupFiles: ['src/test/setup-renderer.ts'],
          testTimeout: 15000,
        },
      },
    ],
  },
});
