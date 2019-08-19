import * as webpack from 'webpack';

const config: webpack.Configuration = require('./webpack.config.js');

export function compileView(cb) {
  webpack(config).run(() => { cb(); });
}
