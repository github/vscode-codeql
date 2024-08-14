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
    "plugin:github/recommended",
    "plugin:github/typescript",
    "plugin:jest-dom/recommended",
    "plugin:prettier/recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "plugin:deprecation/recommended",
  ],
  rules: {
    "@typescript-eslint/await-thenable": "error",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        vars: "all",
        args: "none",
        ignoreRestSiblings: false,
      },
    ],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: true }],
    "@typescript-eslint/no-invalid-this": "off",
    "@typescript-eslint/no-shadow": "off",
    "prefer-const": ["warn", { destructuring: "all" }],
    "@typescript-eslint/only-throw-error": "error",
    "@typescript-eslint/consistent-type-imports": "error",
    "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
    curly: ["error", "all"],
    "escompat/no-regexp-lookbehind": "off",
    "etc/no-implicit-any-catch": "error",
    "filenames/match-regex": "off",
    "i18n-text/no-en": "off",
    "no-invalid-this": "off",
    "no-console": "off",
    "no-shadow": "off",
    "github/array-foreach": "off",
    "github/no-then": "off",
    "react/jsx-key": ["error", { checkFragmentShorthand: true }],
    "import/no-cycle": "error",
    // Never allow extensions in import paths, except for JSON files where they are required.
    "import/extensions": ["error", "never", { json: "always" }],
  },
  settings: {
    "import/resolver": {
      typescript: true,
      node: true,
    },
    "import/extensions": [".js", ".jsx", ".ts", ".tsx", ".json"],
    // vscode and sarif don't exist on-disk, but only provide types.
    "import/core-modules": ["vscode", "sarif"],
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
        "plugin:react/jsx-runtime",
        "plugin:react-hooks/recommended",
        "plugin:storybook/recommended",
        "plugin:github/react",
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
        "plugin:react/jsx-runtime",
        "plugin:react-hooks/recommended",
        "plugin:github/react",
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
      files: ["test/vscode-tests/**/*"],
      parserOptions: {
        project: resolve(__dirname, "test/tsconfig.json"),
      },
      env: {
        jest: true,
      },
      rules: {
        ...baseConfig.rules,
        // We want to allow mocking of functions in modules, so we need to allow namespace imports.
        "import/no-namespace": "off",
        "@typescript-eslint/no-unsafe-function-type": "off",
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
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
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
    {
      files: [".storybook/**/*.tsx"],
      parserOptions: {
        project: resolve(__dirname, ".storybook/tsconfig.json"),
      },
      rules: {
        ...baseConfig.rules,
        // Storybook doesn't use the automatic JSX runtime in the addon yet, so we need to allow
        // `React` to be imported.
        "import/no-namespace": ["error", { ignore: ["react"] }],
      },
    },
  ],
};
