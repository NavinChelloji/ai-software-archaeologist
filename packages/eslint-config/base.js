const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const prettier = require("eslint-config-prettier");
const globals = require("globals");

module.exports = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/explicit-function-return-type": [
        "warn",
        { allowExpressions: true },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // Plain Node scripts that ship outside the TypeScript build (e.g. a
    // service's production static-file server) — not covered by
    // typescript-eslint's type-aware globals.
    files: ["**/*.mjs", "**/*.cjs"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      // Plain JS has no return-type syntax; console output is the point of a script.
      "@typescript-eslint/explicit-function-return-type": "off",
      "no-console": "off",
    },
  },
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**", "*.config.*"],
  },
  prettier
);
