const { resolve } = require("path");

const baseConfig = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
    project: [
      resolve(__dirname, "tsconfig.lint.json"),
      resolve(__dirname, "src/**/tsconfig.json"),
      resolve(__dirname, "test/**/tsconfig.json"),
      resolve(__dirname, "gulpfile.ts/tsconfig.json"),
      resolve(__dirname, "scripts/tsconfig.json"),
      resolve(__dirname, ".storybook/tsconfig.json"),
    ],
  },
  plugins: ["github", "@typescript-eslint", "etc"],
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
    "plugin:@typescript-eslint/recommended",
  ],
  rules: {
    "@typescript-eslint/await-thenable": "error",
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
    "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: true }],
    "@typescript-eslint/no-invalid-this": "off",
    "@typescript-eslint/no-shadow": "off",
    "prefer-const": ["warn", { destructuring: "all" }],
    "@typescript-eslint/no-throw-literal": "error",
    "no-useless-escape": 0,
    camelcase: "off",
    "escompat/no-regexp-lookbehind": "off",
    "etc/no-implicit-any-catch": "error",
    "filenames/match-regex": "off",
    "filenames/match-regexp": "off",
    "func-style": "off",
    "i18n-text/no-en": "off",
    "import/named": "off",
    "import/no-dynamic-require": "off",
    "import/no-dynamic-required": "off",
    "import/no-anonymous-default-export": "off",
    "import/no-commonjs": "off",
    "import/no-mutable-exports": "off",
    "import/no-namespace": "off",
    "import/no-unresolved": "off",
    "import/no-webpack-loader-syntax": "off",
    "jsx-a11y/anchor-is-valid": "off",
    "jsx-a11y/no-noninteractive-element-interactions": "off",
    "jsx-a11y/no-static-element-interactions": "off",
    "jsx-a11y/click-events-have-key-events": "off",
    "no-invalid-this": "off",
    "no-fallthrough": "off",
    "no-console": "off",
    "no-shadow": "off",
    "github/array-foreach": "off",
    "github/no-then": "off",
  },
};

module.exports = {
  root: true,
  ...baseConfig,
  overrides: [
    {
      files: ["src/stories/**/*"],
      parserOptions: {
        project: resolve(__dirname, "src/stories/tsconfig.json"),
      },
      extends: [
        ...baseConfig.extends,
        "plugin:react/recommended",
        "plugin:react-hooks/recommended",
        "plugin:storybook/recommended",
      ],
      rules: {
        ...baseConfig.rules,
      },
      settings: {
        react: {
          version: "detect",
        },
      },
    },
    {
      files: ["src/view/**/*"],
      parserOptions: {
        project: resolve(__dirname, "src/view/tsconfig.json"),
      },
      extends: [
        ...baseConfig.extends,
        "plugin:react/recommended",
        "plugin:react-hooks/recommended",
      ],
      rules: {
        ...baseConfig.rules,
      },
      settings: {
        react: {
          version: "detect",
        },
      },
    },
    {
      files: ["test/**/*"],
      parserOptions: {
        project: resolve(__dirname, "test/tsconfig.json"),
      },
      env: {
        jest: true,
      },
    },
    {
      files: ["test/vscode-tests/**/*"],
      parserOptions: {
        project: resolve(__dirname, "test/tsconfig.json"),
      },
      env: {
        jest: true,
      },
      rules: {
        ...baseConfig.rules,
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
    },
    {
      files: [
        ".eslintrc.js",
        "test/**/jest-runner-vscode.config.js",
        "test/**/jest-runner-vscode.config.base.js",
      ],
      parser: undefined,
      plugins: ["github"],
      extends: [
        "eslint:recommended",
        "plugin:github/recommended",
        "plugin:prettier/recommended",
      ],
      rules: {
        "import/no-commonjs": "off",
        "prefer-template": "off",
        "filenames/match-regex": "off",
        "@typescript-eslint/no-var-requires": "off",
      },
    },
  ],
};
