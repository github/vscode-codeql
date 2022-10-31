const path = require('path');

require('ts-node').register({
  project: path.resolve(__dirname, 'tsconfig.json')
})

process.env.TZ = 'UTC';
process.env.LANG = 'en-US';
