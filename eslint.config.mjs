import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import designSystemRules from "./eslint.rules.design-system.js";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // DESIGN_SYSTEM.md §3 (content width) and §13b (page heading) enforcement.
  ...designSystemRules,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
