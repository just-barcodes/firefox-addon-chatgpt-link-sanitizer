import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "dist/", "web-ext-artifacts/"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: { ...globals.browser, ...globals.webextensions },
    },
  },
  {
    files: ["test/**/*.js", "eslint.config.js"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
];
