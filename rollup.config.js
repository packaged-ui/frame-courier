import {terser} from "rollup-plugin-terser";
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';

process.chdir(__dirname);
const ieBrowsers = ['ie > 9', '> 0.02%', 'last 2 versions', 'Firefox ESR'];

const defaultCfg = {
  input: './dist.js',
  output: {
    file: './dist/frame-courier.min.js',
    name: 'FrameCourier',
    format: 'iife'
  },
  plugins: [
    resolve({browser: true, preferBuiltins: false}),
    commonjs(),
    terser(),

    babel(
      {
        babelHelpers: 'bundled',
        babelrc: false,
        exclude: [/\/core-js\//],
        presets: [
          [
            '@babel/preset-env',
            {
              corejs: 3,
              modules: false,
              useBuiltIns: 'usage',
              targets: ieBrowsers,
            },
          ],
        ],
      }),
  ]
};

export default [defaultCfg];