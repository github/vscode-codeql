module.exports = {
  env: {
    browser: true
  },
  plugins: [
    "github",
  ],
  extends: [
    "plugin:github/react",
    "plugin:github/recommended",
    "plugin:github/typescript",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-invalid-this": "off",
    "@typescript-eslint/no-shadow": "off",
    "camelcase": "off",
    "eqeqeq": "off",
    "filenames/match-regex": "off",
    "i18n-text/no-en": "off",
    "import/named": "off",
    "import/no-dynamic-require": "off",
    "import/no-dynamic-required": "off",
    "import/no-namespace": "off",
    "import/no-unresolved": "off",
    "jsx-a11y/anchor-is-valid": "off",
    "jsx-a11y/no-noninteractive-element-interactions": "off",
    "jsx-a11y/no-static-element-interactions": "off",
    "jsx-a11y/click-events-have-key-events": "off",
    "no-console": "off",
    "no-invalid-this": "off",
    "no-undef": "off",
    "no-unused-vars": "off",
    "no-shadow": "off",
    "github/array-foreach": "off",
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
}
