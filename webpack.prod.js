/* eslint-disable no-undef */
const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");

module.exports = [merge(common, {
  name: "app",
  mode: "production",
  devtool: "source-map",
}), require("./webpack.save")("production")];
