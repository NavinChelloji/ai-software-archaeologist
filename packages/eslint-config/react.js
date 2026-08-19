const reactHooks = require("eslint-plugin-react-hooks");
// ESM-only package; CJS require() surfaces the plugin under .default.
const reactRefresh = require("eslint-plugin-react-refresh").default;
const base = require("./base.js");

module.exports = [
  ...base,
  {
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
];
