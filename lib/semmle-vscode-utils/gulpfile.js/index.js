'use strict';

require('ts-node').register({});
const gulp = require('gulp');
const { compileTypeScript, watchTypeScript } = require('build-tasks');

exports.default = compileTypeScript;
exports.watchTypeScript = watchTypeScript;
