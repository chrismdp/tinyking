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
    port: 8190,
    historyApiFallback: true,
    host: "0.0.0.0"
  }
}), require("./webpack.save")("development")];
