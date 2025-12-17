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

      // Rules disabled during eslint 9 migration
      "github/filenames-match-regex": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/restrict-plus-operands": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-array-delete": "off",
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
        projectService: {
          allowDefaultProject: ['jest.config.js'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["src/stories/**/*"],
    extends: [
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      reactHooks.configs.flat['recommended-latest'],
      storybook.configs['flat/recommended'],
      github.getFlatConfigs().react,
    ],
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // Disable new strict rules from eslint-plugin-react-hooks 7.0.1 that fail with current codebase
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["src/view/**/*"],
    extends: [
      react.configs.flat.recommended,
      react.configs.flat['jsx-runtime'],
      reactHooks.configs.flat['recommended-latest'],
      github.getFlatConfigs().react,
    ],
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      // Disable new strict rules from eslint-plugin-react-hooks 7.0.1 that fail with current codebase
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/error-boundaries": "off",
    },
  },
  {
    // Special case for files using custom useEffectEvent implementation
    files: [
      "src/view/common/SuggestBox/useOpenKey.ts",
      "src/view/common/SuggestBox/__tests__/useEffectEvent.test.ts",
    ],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    files: ["test/vscode-tests/**/*"],
    languageOptions: {
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
      globals: {
        jest: true,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",

      // Rules disabled during eslint 9 migration
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/unbound-method": "off",
    },
  },
  {
    files: [".storybook/**/*", "src/stories/**/*"],
    rules: {
      // Storybook doesn't use the automatic JSX runtime in the addon yet, so we need to allow
      // `React` to be imported.
      "import/no-namespace": ["error", { ignore: ["react"] }],

      // Rules disabled during eslint 9 migration
      "@typescript-eslint/no-unsafe-argument": "off",
      "storybook/no-renderer-packages": "off",
      "storybook/story-exports": "off",
    },
  },
  eslintPrettierRecommended,
);
