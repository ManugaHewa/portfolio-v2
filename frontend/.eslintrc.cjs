/* ESLint 8 flat-config is opt-in; this project stays on the .eslintrc format
   the installed version reads by default. CI runs `npm run lint` in both
   workspaces, so this file is what makes that step meaningful rather than a
   command that exits 2 because it found no configuration. */
module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
  plugins: ["@typescript-eslint", "react-hooks"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
  ],
  ignorePatterns: ["dist", "node_modules", "*.cjs"],
  rules: {
    // The canvas graph and the GSAP timelines legitimately need non-null
    // assertions after their own guards; flag them as warnings, not errors.
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
  overrides: [
    {
      files: ["src/__tests__/**/*.{ts,tsx}", "src/test-setup.ts"],
      env: { node: true },
      rules: { "@typescript-eslint/no-explicit-any": "off" },
    },
  ],
};
