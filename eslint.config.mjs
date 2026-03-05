import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // ── TypeScript: gradually tighten ─────────────────────────────────
    "@typescript-eslint/no-explicit-any": "warn",       // track any usage
    "@typescript-eslint/no-unused-vars": ["warn", {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
    }],
    "@typescript-eslint/no-non-null-assertion": "off",  // too noisy still
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "warn",
    "@typescript-eslint/no-unused-disable-directive": "off",
    
    // ── React ─────────────────────────────────────────────────────────
    "react-hooks/exhaustive-deps": "error",
    "react-hooks/purity": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",
    
    // ── Next.js ───────────────────────────────────────────────────────
    "@next/next/no-img-element": "warn",
    "@next/next/no-html-link-for-pages": "off",
    
    // ── General JavaScript ────────────────────────────────────────────
    "prefer-const": "warn",
    "no-unused-vars": "off",          // handled by TS rule above
    "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    "no-debugger": "error",
    "no-empty": "warn",
    "no-irregular-whitespace": "off",
    "no-case-declarations": "warn",
    "no-fallthrough": "warn",
    "no-mixed-spaces-and-tabs": "off",
    "no-redeclare": "warn",
    "no-undef": "off",
    "no-unreachable": "error",
    "no-useless-escape": "warn",
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills"]
}];

export default eslintConfig;
