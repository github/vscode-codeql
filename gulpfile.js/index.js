'use strict';

require('ts-node').register({});
const gulp = require('gulp');
const { packageExtension } = require('./package');
const { compileTextMateGrammar } = require('./textmate');
const { compileTypeScript, watchTypeScript } = require('./typescript');

exports.compileTypeScript = compileTypeScript;
exports.compileTextMateGrammar = compileTextMateGrammar;
exports.buildWithoutPackage = gulp.parallel(compileTypeScript, compileTextMateGrammar);
exports.default = gulp.series(exports.buildWithoutPackage, packageExtension);
exports.watchTypeScript = watchTypeScript;
