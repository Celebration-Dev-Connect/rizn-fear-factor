import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "drizzle/**",
      "test-results/**",
      "playwright-report/**",
      "next-env.d.ts",
      ".specify/**",
      ".claude/**",
      "site/out/**",
      "site/.next/**",
      "site/next-env.d.ts",
    ],
  },
];

export default config;
