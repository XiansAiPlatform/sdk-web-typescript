import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

const external = ['@microsoft/signalr'];

export default [
  // ES Modules build
  {
    input: 'index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'es',
      sourcemap: true,
    },
    external,
    plugins: [
      resolve({
        browser: true,
      }),
      commonjs(),
      typescript({
        declaration: true,
        declarationDir: 'dist',
        declarationMap: true,
        rootDir: '.',
      }),
    ],
  },
  // CommonJS build
  {
    input: 'index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    external,
    plugins: [
      resolve({
        browser: true,
      }),
      commonjs(),
      typescript({
        declaration: false, // Only generate declarations once
        rootDir: '.',
      }),
    ],
  },
]; 