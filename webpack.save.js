/* eslint-disable no-undef */
// A service worker keeps a pagehide save alive after its page navigates away.
const path = require("path");
const common = require("./webpack.common");
module.exports = mode => ({
  name: "save-worker",
  // The app cleans dist at emit. Write this worker after that clean finishes.
  dependencies: mode === "production" ? ["app"] : undefined,
  mode,
  target: "webworker",
  entry: "./src/game/save_worker.js",
  output: { path: path.resolve(__dirname, "dist"), filename: "save-worker.js", publicPath: "/" },
  devtool: mode === "production" ? "source-map" : "inline-source-map",
  resolve: common.resolve,
  module: common.module
});
