// Flat config for ESLint 9 + Next.js 16.
// Uses eslint-config-next's native flat presets directly. (The old FlatCompat
// shim loading "next/core-web-vitals" crashed @eslint/eslintrc with a circular
// JSON error under Next 16, so it was removed.)
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  // Standalone Node/CommonJS utility scripts — not part of the Next app.
  { ignores: ["supabase/scripts/**"] },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // New advisory lints from eslint-plugin-react-hooks 7 (React Compiler era).
      // Downgraded to warn for now, consistent with exhaustive-deps above — real
      // pre-existing violations to clean up incrementally, not release blockers.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",

      // Relax TypeScript any type rules for now
      "@typescript-eslint/no-explicit-any": "warn",

      // Allow unused variables with underscore prefix
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],

      // Allow missing dependencies in useEffect (can be complex to fix)
      "react-hooks/exhaustive-deps": "warn",

      // Allow unescaped entities (often intentional)
      "react/no-unescaped-entities": "warn",

      // Allow img tags (next/image can be added later)
      "@next/next/no-img-element": "warn",

      // Rules of hooks must be errors (React hooks in wrong places are real bugs)
      "react-hooks/rules-of-hooks": "error",

      // Allow unsafe function types for now
      "@typescript-eslint/no-unsafe-function-type": "warn",
    },
  },
];

export default eslintConfig;
