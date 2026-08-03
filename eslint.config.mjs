import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
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
