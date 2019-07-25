'use strict';

require('ts-node').register({});
const { compileTypeScript, watchTypeScript } = require('../src/index');

exports.default = compileTypeScript;
exports.watchTypeScript = watchTypeScript;
