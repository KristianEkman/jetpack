// eslint.config.js
export default [
  {
    rules: {
      "no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }],
      "no-unreachable": "error",
      "no-constant-condition": "warn"
    }
  }
];