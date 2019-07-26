import * as webpack from 'webpack';
import * as gulp from 'gulp';
const config: webpack.Configuration = require('./webpack.config.js');

export function compileView(cb) {
  webpack(config).run(() => { cb(); });
}
