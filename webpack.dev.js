/* eslint-disable no-undef */
const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");
const path = require("path");

module.exports = [merge(common, {
  mode: "development",
  devtool: "inline-source-map",
  devServer: {
    client: false,
    hot: false,
    liveReload: false,
    static: path.resolve(__dirname, "dist"),
    historyApiFallback: true,
    host: "0.0.0.0",
    setupMiddlewares: middlewares => {
      middlewares.unshift({ name: "worlds", middleware: require("./scripts/serve-worlds") });
      return middlewares;
    }
  }
}), require("./webpack.save")("development")];
