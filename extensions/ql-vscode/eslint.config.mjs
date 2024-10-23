import { fixupConfigRules } from "@eslint/compat";

import js from "@eslint/js";
import jestDom from "eslint-plugin-jest-dom";
import tseslint from "typescript-eslint";
import prettier from "eslint-plugin-prettier/recommended";
import importPlugin from "eslint-plugin-import";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import { resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    files: ["**/*.js", "**/*.ts", "**/*.tsx"],
    ignores: [
      "**/.vscode-test/",
      "**/node_modules/",
      "**/out/",
      "**/build/",
      // Ignore js files
      "**/eslint.config.mjs",
      "**/jest.config.js",
      "test/vscode-tests/activated-extension/jest-runner-vscode.config.js",
      "test/vscode-tests/cli-integration/jest-runner-vscode.config.js",
      "test/vscode-tests/jest-runner-vscode.config.base.js",
      "test/vscode-tests/minimal-workspace/jest-runner-vscode.config.js",
      "test/vscode-tests/no-workspace/jest-runner-vscode.config.js",
      // Include the Storybook config
      "!**/.storybook",
    ],
  },
  js.configs.recommended,
  ...fixupConfigRules(
    compat.extends("plugin:github/recommended", "plugin:github/typescript"),
  ),
  jestDom.configs["flat/recommended"],
  prettier,
  ...tseslint.configs.recommended,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },

      parser: tsParser,
      ecmaVersion: 2018,
      sourceType: "module",

      parserOptions: {
        project: [
          resolve(__dirname, "tsconfig.lint.json"),
          resolve(__dirname, "src/**/tsconfig.json"),
          resolve(__dirname, "test/**/tsconfig.json"),
          resolve(__dirname, "gulpfile.ts/tsconfig.json"),
          resolve(__dirname, "scripts/tsconfig.json"),
          resolve(__dirname, ".storybook/tsconfig.json"),
        ],
      },
    },

    settings: {
      "import/resolver": {
        typescript: true,
        node: true,
      },

      "import/extensions": [".js", ".jsx", ".ts", ".tsx", ".json"],
      "import/core-modules": ["vscode", "sarif"],
    },
  },
  {
    files: ["src/stories/**/*"],
    languageOptions: {
      ecmaVersion: 5,
      sourceType: "script",

      parserOptions: {
        project: resolve(__dirname, "src/stories/tsconfig.json"),
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  ...fixupConfigRules(
    compat.extends(
      "plugin:react/recommended",
      "plugin:react/jsx-runtime",
      "plugin:react-hooks/recommended",
      "plugin:storybook/recommended",
      "plugin:github/react",
    ),
  ).map((config) => ({
    ...config,
    files: ["src/stories/**/*"],
  })),
  ...fixupConfigRules(
    compat.extends(
      "plugin:react/recommended",
      "plugin:react/jsx-runtime",
      "plugin:react-hooks/recommended",
      "plugin:github/react",
    ),
  ).map((config) => ({
    ...config,
    files: ["src/view/**/*"],
  })),
  {
    files: ["src/view/**/*"],

    languageOptions: {
      ecmaVersion: 5,
      sourceType: "script",

      parserOptions: {
        project: resolve(__dirname, "src/view/tsconfig.json"),
      },
    },

    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    files: ["test/vscode-tests/**/*"],

    languageOptions: {
      globals: {
        ...globals.jest,
      },

      ecmaVersion: 5,
      sourceType: "script",

      parserOptions: {
        project: resolve(__dirname, "test/tsconfig.json"),
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
        ...globals.jest,
      },

      ecmaVersion: 5,
      sourceType: "script",

      parserOptions: {
        project: resolve(__dirname, "test/tsconfig.json"),
      },
    },

    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: [
      "**/.eslintrc.js",
      "test/**/jest-runner-vscode.config.js",
      "test/**/jest-runner-vscode.config.base.js",
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

    languageOptions: {
      ecmaVersion: 5,
      sourceType: "script",

      parserOptions: {
        project: resolve(__dirname, ".storybook/tsconfig.json"),
      },
    },

    rules: {
      // Storybook doesn't use the automatic JSX runtime in the addon yet, so we need to allow
      // `React` to be imported.
      "import/no-namespace": [
        "error",
        {
          ignore: ["react"],
        },
      ],
    },
  },
];
