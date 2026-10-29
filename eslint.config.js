/* eslint-disable no-undef */
const js = require("@eslint/js");
const globals = require("globals");
const react = require("eslint-plugin-react");
const reactHooks = require("eslint-plugin-react-hooks");

module.exports = [
  js.configs.recommended,
  react.configs.flat.recommended,
  {
    plugins: {
      "react-hooks": reactHooks
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: { jsx: true }
      },
      globals: {
        ...globals.browser,
        "VERSION": "writable",
        "process": "writable"
      }
    },
    settings: {
      react: {
        version: "detect",
      }
    },
    rules: {
      // NOTE: the plugin's two original hook rules, as eslint-plugin-react-hooks
      // 4 recommended them; the React Compiler rules its recommended set now
      // includes are a change of lint policy, not part of an upgrade
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": "warn",
      "indent": [
        "warn",
        2
      ],
      "linebreak-style": [
        "error",
        "unix"
      ],
      "quotes": [
        "error",
        "double"
      ],
      "semi": [
        "error",
        "always"
      ],
      "require-yield": [
        "warn"
      ]
    }
  }
];
