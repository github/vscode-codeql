'use strict';

require('ts-node').register({});
const gulp = require('gulp');
const {
  compileTypeScript,
  watchTypeScript,
  packageExtension,
  compileTextMateGrammar
} = require('build-tasks');
const { buildProtocols } = require('./build-proto');
const { compileView } = require('./webpack');

const compile = gulp.series(buildProtocols, compileTypeScript);
exports.buildWithoutPackage = gulp.parallel(compile, compileTextMateGrammar, compileView);
exports.compileTextMateGrammar = compileTextMateGrammar;
exports.default = gulp.series(exports.buildWithoutPackage, packageExtension);
exports.watchTypeScript = watchTypeScript;
exports.compileView = compileView;
