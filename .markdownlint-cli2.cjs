const options = require('@github/markdownlint-github').init({
  "MD013": false, // Line length
  "MD041": false, // First line in file should be a top level heading
})
module.exports = {
    config: options,
    customRules: ["@github/markdownlint-github"],
    outputFormatters: [
      [ "markdownlint-cli2-formatter-pretty", { "appendLink": true } ] // ensures the error message includes a link to the rule documentation
    ]
}
