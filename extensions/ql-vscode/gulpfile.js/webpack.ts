import * as webpack from 'webpack';

const config: webpack.Configuration = require('./webpack.config.js');

export function compileView(cb) {
  webpack(config).run((error, stats) => {
    if (error) {
      cb(error);
    }
    console.log(stats.toString({
      errorDetails: true,
      colors: true,
      assets: false,
      builtAt: false,
      version: false,
      hash: false,
      entrypoints: false,
      timings: false,
      modules: false
    }));
    if (stats.hasErrors()) {
      cb(new Error('Compilation errors detected.'));
      return;
    }

    cb();
  });
}
