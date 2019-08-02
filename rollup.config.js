import {terser} from "rollup-plugin-terser";
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

process.chdir(__dirname);

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
  ]
};

export default [defaultCfg];