import node from 'rollup-plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2'

export default {
  input: 'src/js/main.ts',
  output: [
    {
      name: 'deepspeech_main',
      file: 'public/js/main.js',
      format: 'iife',
      sourcemap: true,
    },
  ],
  plugins: [
    node(),
    typescript({
        clean: true,
        tsconfigOverride: {
          compilerOptions: {
            module: 'ES2015',
            sourceMap: true,
            inlineSourceMap: false
          },
          include: ['src/js/**/*']
        }
    }),
  ],
}
