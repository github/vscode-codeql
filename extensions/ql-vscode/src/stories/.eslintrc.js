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
    "plugin:storybook/recommended",
  ],
  rules: {
    "filenames/match-regex": "off",
    "import/named": "off",
    "import/no-unresolved": "off",
    "no-unused-vars": "off",
  },
  settings: {
    react: {
      version: 'detect'
    }
  }
}
