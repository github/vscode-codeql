module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
    ecmaFeatures: {
      modules: true,
    },
  },
  plugins: ['@typescript-eslint'],
  env: {
    node: true,
    es6: true
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/no-use-before-define': 0,
    '@typescript-eslint/no-unused-vars': ["warn", {
      "vars": "all",
      "args": "none",
      "ignoreRestSiblings": false
    }],
    "@typescript-eslint/explicit-function-return-type": ["warn", {
      allowExpressions: true
    }],
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-explicit-any": "off"
  },
};
