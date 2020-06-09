'use strict';

require('ts-node').register({});
const { compileTypeScript, watchTypeScript } = require('@github/codeql-gulp-tasks');

exports.default = compileTypeScript;
exports.watchTypeScript = watchTypeScript;
