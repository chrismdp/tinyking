/* eslint-disable no-undef */
// Load the game's source aliases in standalone Node measurement scripts.
const fs = require("fs");
const path = require("path");
const Module = require("module");
const babel = require("@babel/core");
const root = path.resolve(__dirname, "..");
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request, ...args) {
  if (/^(game|data|render)\//.test(request)) request = path.join(root, "src", request);
  return resolve.call(this, request, ...args);
};
const load = require.extensions[".js"];
require.extensions[".js"] = function(module, filename) {
  if (!filename.startsWith(path.join(root, "src") + path.sep)) return load(module, filename);
  const { code } = babel.transformFileSync(filename, { presets: [["@babel/preset-env", { targets: { node: "current" }, modules: "commonjs" }]], babelrc: false, configFile: false });
  module._compile(code, filename);
};
require.extensions[".csv"] = function(module, filename) {
  module.exports = fs.readFileSync(filename, "utf8").trim().split("\n").map(line => line.split(","));
};
