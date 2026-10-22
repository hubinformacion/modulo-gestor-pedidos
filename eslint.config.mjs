import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/shared/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["@/app/**", "@/components/**", "@/modules/**", "@/integrations/**", "@/db", "@/db/**"], message: "El código transversal no depende de las áreas de negocio, persistencia ni interfaz." }],
      }],
    },
  },
  {
    files: ["src/integrations/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["@/app/**", "@/components/**", "@/modules/*/application/**"], message: "Los adaptadores técnicos no coordinan casos de uso ni dependen de la interfaz." }],
      }],
    },
  },
  {
    files: ["src/modules/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["@/app/**", "@/components/**"], message: "Los módulos no dependen de páginas, acciones ni componentes de interfaz." }],
      }],
    },
  },
  {
    files: ["src/modules/*/data/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{ group: ["@/app/**", "@/components/**", "@/modules/*/application/**", "next", "next/**"], message: "La persistencia no depende de la capa de aplicación ni de Next.js." }],
      }],
    },
  },
  {
    files: ["src/modules/*/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["@/app/**", "@/components/**", "@/db", "@/db/**", "@/integrations/**", "@/modules/*/application/**", "@/modules/*/data/**", "@/shared/config/**", "@/shared/logging/**", "next", "next/**", "drizzle-orm", "drizzle-orm/**"],
          message: "El dominio solo contiene reglas y contratos; no depende de rutas, persistencia ni servicios externos.",
        }],
      }],
    },
  },
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
