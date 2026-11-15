/* ESLint 8 reads .eslintrc by default; CI's `npm run lint` needs this config. */
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
    // Some guarded lookups need non-null assertions: warn, don't fail.
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
