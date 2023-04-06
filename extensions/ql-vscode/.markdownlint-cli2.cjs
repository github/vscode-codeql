// Having the base options in a top-level config file means
// that the VS Code markdownlint extension can pick them up
// too, since that only considers _this_ file when looking
// at files in this directory or below.
base_options = require('../../.markdownlint.json')

const options = require('@github/markdownlint-github').init(
  base_options
)
module.exports = {
    config: options,
    customRules: ["@github/markdownlint-github"],
    outputFormatters: [
      [ "markdownlint-cli2-formatter-pretty", { "appendLink": true } ] // ensures the error message includes a link to the rule documentation
    ]
} 
