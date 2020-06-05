'use strict';

require('ts-node').register({});
const { compileTypeScript, watchTypeScript } = require('@github/codeql-build-tasks');

exports.default = compileTypeScript;
exports.watchTypeScript = watchTypeScript;
