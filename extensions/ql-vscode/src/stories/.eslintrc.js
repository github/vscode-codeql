module.exports = {
  env: {
    browser: true
  },
  extends: [
    "plugin:react/recommended",
    "plugin:storybook/recommended",
  ],
  settings: {
    react: {
      version: 'detect'
    }
  }
}
