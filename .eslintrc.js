module.exports = {
    "env": {
        "browser": true,
        "es2020": true
    },
    "globals": {
      "VERSION": true,
      "process": true
    },
    "extends": [
      "eslint:recommended",
      "plugin:react/recommended",
      "plugin:react-hooks/recommended"
    ],
    "settings": {
      "react": {
        "version": "detect",
      }
    },
    "parser": "babel-eslint",
    "parserOptions": {
        "ecmaVersion": 11,
        "sourceType": "module"
    },
    "rules": {
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
};
