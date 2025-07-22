import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import eslint from "@eslint/js";
import { globalIgnores } from "eslint/config";
import github from "eslint-plugin-github";
import tseslint from "typescript-eslint";
import eslintPrettierRecommended from 'eslint-plugin-prettier/recommended';
import * as jestDom from "eslint-plugin-jest-dom";
import * as typescriptESLintParser from "@typescript-eslint/parser";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import storybook from "eslint-plugin-storybook";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  globalIgnores([
    ".vscode-test/",
    "node_modules/",
    "out/",
    "build/",
    "scripts/",
    "**/jest.config.ts",
    "**/jest.config.js",
    "**/jest-runner-vscode.config.js",
    "**/jest-runner-vscode.config.base.js",
    ".markdownlint-cli2.cjs",
    "eslint.config.mjs",
    "!.storybook",
  ]),
  github.getFlatConfigs().recommended,
  ...github.getFlatConfigs().typescript,
  tseslint.configs.recommendedTypeChecked,
  eslint.configs.recommended,
  tseslint.configs.recommended,
  jestDom.configs["flat/recommended"],
  {
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
      "filenames/match-regex": "off",
      "i18n-text/no-en": "off",
      "no-invalid-this": "off",
      "no-console": "off",
      "no-shadow": "off",
      "github/array-foreach": "off",
      "github/no-then": "off",
      // "react/jsx-key": ["error", { checkFragmentShorthand: true }],
      "import/no-cycle": "error",
      // Never allow extensions in import paths, except for JSON files where they are required.
      "import/extensions": ["error", "never", { json: "always" }],
    },
    settings: {
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"]
      },
      "import/resolver": {
        typescript: true,
        node: true,
      },
      "import/extensions": [".js", ".jsx", ".ts", ".tsx", ".json"],
      // vscode and sarif don't exist on-disk, but only provide types.
      "import/core-modules": ["vscode", "sarif"],
    },
    languageOptions: {
      parser: typescriptESLintParser,
      parserOptions: {
        ecmaVersion: 2018,
        sourceType: "module",
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        project: resolve(__dirname, "tsconfig.lint.json"),
      },
    },
  },
  {
    files: ["src/stories/**/*"],
    languageOptions: {
      parserOptions: {
        project: resolve(__dirname, "src/stories/tsconfig.json"),
      },
    },
    extends: [
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      reactHooks.configs['recommended-latest'],
      storybook.configs['flat/recommended'],
      github.getFlatConfigs().react,
    ],
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    files: ["src/view/**/*"],
    languageOptions: {
      parserOptions: {
        project: resolve(__dirname, "src/view/tsconfig.json"),
      },
    },
    extends: [
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      reactHooks.configs['recommended-latest'],
      github.getFlatConfigs().react,
    ],
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    files: ["test/vscode-tests/**/*"],
    languageOptions: {
      parserOptions: {
        project: resolve(__dirname, "test/tsconfig.json"),
      },
      globals: {
        jest: true,
      },
    },
    rules: {
      // We want to allow mocking of functions in modules, so we need to allow namespace imports.
      "import/no-namespace": "off",
      "@typescript-eslint/no-unsafe-function-type": "off",
    },
  },
  {
    files: ["test/**/*"],
    languageOptions: {
      parserOptions: {
        project: resolve(__dirname, "test/tsconfig.json"),
      },
      globals: {
        jest: true,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: [".storybook/**/*"],
    languageOptions: {
      parserOptions: {
        project: resolve(__dirname, ".storybook/tsconfig.json"),
      },
    },
    rules: {
      // Storybook doesn't use the automatic JSX runtime in the addon yet, so we need to allow
      // `React` to be imported.
      "import/no-namespace": ["error", { ignore: ["react"] }],
    },
  },
  eslintPrettierRecommended,
);
