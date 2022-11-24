module.exports = {
  parserOptions: {
    project: ["../../tsconfig.json"],
  },
  env: {
    jest: true,
  },
  plugins: [
    "github",
  ],
  extends: [
    "plugin:github/react",
    "plugin:github/recommended",
    "plugin:github/typescript",
  ],
  rules: {
    "@typescript-eslint/ban-types": [
      "error",
      {
        // For a full list of the default banned types, see:
        // https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/docs/rules/ban-types.md
        extendDefaults: true,
        types: {
          // Don't complain about the `Function` type in test files. (Default is `true`.)
          Function: false,
        },
      },
    ],
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-shadow": "off",
    "@typescript-eslint/no-invalid-this": "off",
    "eqeqeq": "off",
    "filenames/match-regex": "off",
    "filenames/match-regexp": "off",
    "i18n-text/no-en": "off",
    "import/no-anonymous-default-export": "off",
    "import/no-dynamic-require": "off",
    "import/no-mutable-exports": "off",
    "import/no-namespace": "off",
    "import/no-unresolved": "off",
    "no-console": "off",
    "github/array-foreach": "off",
    "github/no-then": "off"
  }
}
