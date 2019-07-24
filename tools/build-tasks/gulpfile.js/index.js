'use strict';

require('ts-node').register({});
const gulp = require('gulp');
const { compileTypeScript, watchTypeScript } = require('../src/index');

exports.default = compileTypeScript;
exports.watchTypeScript = watchTypeScript;
