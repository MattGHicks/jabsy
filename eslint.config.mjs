import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Not our source: agent worktrees carry their own checkout + node_modules,
    // and .vercel holds pulled build output. Linting them buried the handful of
    // real findings in src/ under ~13k results.
    ".claude/**",
    ".vercel/**",
    "node_modules/**",
  ]),
]);

export default eslintConfig;
