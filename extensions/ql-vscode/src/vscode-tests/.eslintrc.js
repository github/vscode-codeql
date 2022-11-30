module.exports = {
  parserOptions: {
    project: ["../../tsconfig.json"],
  },
  env: {
    jest: true,
  },
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
  },
};
