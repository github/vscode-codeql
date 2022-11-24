module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
    project: ["tsconfig.json", "./src/**/tsconfig.json", "./gulpfile.ts/tsconfig.json", "./scripts/tsconfig.json", "./.storybook/tsconfig.json"],
  },
  plugins: [
    "github",
    "@typescript-eslint"
  ],
  env: {
    node: true,
    es6: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:github/react",
    "plugin:github/recommended",
    "plugin:github/typescript",
    "plugin:jest-dom/recommended",
    "plugin:prettier/recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  rules: {
    "@typescript-eslint/no-use-before-define": 0,
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        vars: "all",
        args: "none",
        ignoreRestSiblings: false,
      },
    ],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-floating-promises": [ "error", { ignoreVoid: true } ],
    "prefer-const": ["warn", { destructuring: "all" }],
    "@typescript-eslint/no-throw-literal": "error",
    "no-useless-escape": 0,
  },
};
