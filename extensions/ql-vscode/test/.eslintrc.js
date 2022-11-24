module.exports = {
  env: {
    jest: true,
  },
  parserOptions: {
    project: "./test/tsconfig.json",
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
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-shadow": "off",
    "camelcase": "off",
    "filenames/match-regex": "off",
    "i18n-text/no-en": "off",
    "import/no-namespace": "off",
    "import/no-unresolved": "off",
    "no-console": "off",
    "no-shadow": "off",
    "no-undef": "off",
    "github/array-foreach": "off",
  }
};
