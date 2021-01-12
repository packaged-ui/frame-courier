import {terser} from "rollup-plugin-terser";
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';

process.chdir(__dirname);

const defaultCfg = {
  input: './demo/demo.js',
  output: {
    file: './demo/demo.min.js',
    name: 'FrameCourier',
    format: 'iife'
  },
  plugins: [
    resolve({browser: true, preferBuiltins: false}),
    commonjs(),
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
            },
          ],
        ],
      }),
    terser(),
  ]
};

export default [defaultCfg];
