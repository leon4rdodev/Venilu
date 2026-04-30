import globals from "globals";
import pluginJs from "@eslint/js";
import tseslintPlugin from "@typescript-eslint/eslint-plugin";
import tseslintParser from "@typescript-eslint/parser";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginJsxA11y from "eslint-plugin-jsx-a11y";
import { fixupConfigRules } from "@eslint/compat";


export default [
  // Ignore compiled files, dev scripts, and node_modules
  {
    ignores: ["dist/**", "dist-electron/**", "node_modules/", "src/main/main-dev.js"],
  },

  // Base Configuration for all files
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    linterOptions: {
      noInlineConfig: false,
      reportUnusedDisableDirectives: true,
    },
    rules: {
      // General rules that apply to all files
      "no-undef": "error", // Keep no-undef as error by default
    },
  },

  // Browser environment for React/Frontend files
  {
    files: ["src/**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        Electron: 'readonly', // Declare Electron as a global
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "jsx-a11y": pluginJsxA11y,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...fixupConfigRules(pluginReact.configs.recommended).rules, // Re-introduce fixupConfigRules
      ...fixupConfigRules(pluginReact.configs["jsx-runtime"]).rules, // Re-introduce fixupConfigRules
      ...pluginReactHooks.configs.recommended.rules,
      ...pluginJsxA11y.configs.recommended.rules,
      "react/react-in-jsx-scope": "off", // Not needed for React 17+ with new JSX transform
      "react/jsx-uses-react": "off", // Not needed for React 17+ with new JSX transform
      // Add or override React specific rules here
    },
  },

  // Node.js environment for Electron, config files, etc.
  {
    files: [
      "electron/**/*.{js,mjs,cjs,ts}",
      "*.config.{js,ts}", // e.g., postcss.config.js, tailwind.config.js, vite.config.ts
      "*.js", // For root level js files like package.json scripts
    ],
    languageOptions: {
      globals: globals.node,
      sourceType: "module", // Assume ES modules for these files
    },
    rules: {
      // Specific rules for Node.js files
      "no-undef": "off", // Temporarily turn off for Node.js files to avoid conflicts with 'require' and 'module'
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    },
  },

  // Specific configuration for electron/preload.js
  {
    files: ["electron/preload.js"],
    languageOptions: {
      globals: {
        ...globals.browser, // preload script has access to browser globals
        window: 'readonly', // Explicitly define window
        // Add any specific Electron preload globals if necessary
        // e.g., 'ipcRenderer': 'readonly'
      },
      sourceType: "module",
    },
    rules: {
      // Removed "no-undef": "off"
    },
  },

  // TypeScript renderer files configuration
  {
    files: ["src/renderer/**/*.{ts,tsx}", "src/shared/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslintParser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tseslintPlugin,
    },
    rules: {
      ...tseslintPlugin.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    },
  },

  // TypeScript main process files configuration
  {
    files: ["src/main/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslintParser,
      parserOptions: {
        project: './tsconfig.electron.json',
        ecmaFeatures: { jsx: true },
      },
      globals: globals.node,
    },
    plugins: {
      '@typescript-eslint': tseslintPlugin,
    },
    rules: {
      ...tseslintPlugin.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-undef": "off", // Node globals handled by globals.node
    },
  },

  // TypeScript Node.js config files configuration (e.g., vite.config.ts)
  {
    files: ["*.config.ts"],
    languageOptions: {
      parser: tseslintParser,
      parserOptions: {
        project: './tsconfig.node.json',
        ecmaFeatures: { jsx: true },
      },
      globals: globals.node,
    },
    plugins: {
      '@typescript-eslint': tseslintPlugin,
    },
    rules: {
      ...tseslintPlugin.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-undef": "off", // Allow Node.js globals
    },
  },

  // General recommended rules
  pluginJs.configs.recommended,
];