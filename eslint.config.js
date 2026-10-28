// @ts-check
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import { defineConfig, globalIgnores, includeIgnoreFile } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import i18next from "eslint-plugin-i18next";
import jsxA11y from "eslint-plugin-jsx-a11y-x";
import reactHooks from "eslint-plugin-react-hooks";
import { reactRefresh } from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  // Everything git ignores (build output, tool state such as .wrangler/), plus committed files
  // that are generated or reference material.
  includeIgnoreFile(fileURLToPath(new URL(".gitignore", import.meta.url))),
  globalIgnores(["**/*.gen.ts", "docs/reference/"]),

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  comments.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      // Every eslint-disable must say why (BLUEPRINT §8: no `any` without a reason).
      "@eslint-community/eslint-comments/require-description": [
        "error",
        { ignore: ["eslint-enable"] },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      eqeqeq: ["error", "smart"],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },

  // The web app: React rules, accessibility, and no hard-coded user-facing text.
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    extends: [
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite(),
      jsxA11y.configs.strict,
      i18next.configs["flat/recommended"],
    ],
    rules: {
      // JSX text and the attributes people read or hear must come from translations.
      "i18next/no-literal-string": [
        "error",
        {
          mode: "jsx-only",
          "jsx-attributes": {
            include: [
              "aria-label",
              "aria-description",
              "aria-placeholder",
              "aria-roledescription",
              "aria-valuetext",
              "alt",
              "label",
              "placeholder",
              "title",
            ],
            exclude: [".*"],
          },
        },
      ],
    },
  },
  {
    // Route files export `Route` next to their components. TanStack Router's code splitting moves
    // each route component into its own module and handles its hot reload.
    files: ["apps/web/src/routes/**/*.tsx"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: [
      "**/*.test.{ts,tsx}",
      "apps/web/src/test/**",
      "apps/web/e2e/**",
      "apps/web/e2e-stack/**",
    ],
    rules: {
      "i18next/no-literal-string": "off",
    },
  },

  // Node-side files: configs, scripts and end-to-end tests.
  {
    files: [
      "*.{js,ts}",
      "apps/web/*.{js,ts}",
      "apps/web/e2e/**",
      "apps/web/e2e-stack/**",
      "apps/web/scripts/**",
      "apps/web/build/**",
      "scripts/**",
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  // Edge Functions run in Supabase's Edge Runtime (Deno): web APIs only, no Node modules. Their
  // tests run in Node and may use it.
  {
    files: ["supabase/functions/**/*.ts"],
    ignores: ["supabase/functions/**/*.test.ts", "supabase/functions/vitest.config.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [{ regex: "^node:", message: "Edge Functions run in Deno; use web APIs." }] },
      ],
    },
  },
  {
    files: ["supabase/functions/**/*.test.ts", "supabase/functions/vitest.config.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ["apps/web/public/**/*.js"],
    languageOptions: {
      globals: globals.browser,
      sourceType: "script",
    },
  },

  prettier,
]);
