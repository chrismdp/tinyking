/* eslint-disable no-undef */
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const HtmlWebpackRootPlugin = require("html-webpack-root-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const { GitRevisionPlugin } = require("git-revision-webpack-plugin");
const webpack =  require("webpack");

var gitRevisionPlugin = new GitRevisionPlugin();

module.exports = {
  entry: {
    app: "./src/index.js",
  },
  resolve: {
    modules: [
      path.resolve(__dirname, "src"),
      "node_modules"
    ],
  },
  plugins: [
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      title: "Tiny King",
      meta: {
        "viewport":"user-scalable=no,initial-scale=1,maximum-scale=1,minimum-scale=1,width=device-width",
        "apple-mobile-web-app-capable": "yes"
      }
    }),
    new HtmlWebpackRootPlugin(),
    gitRevisionPlugin,
    new webpack.DefinePlugin({
      VERSION: JSON.stringify(gitRevisionPlugin.version())
    })
  ],
  output: {
    filename: "[name].[contenthash].js",
    path: path.resolve(__dirname, "dist"),
  },
  optimization: {
    moduleIds: "deterministic",
    runtimeChunk: "single",
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /[/]node_modules[/]/,
          name: "vendors",
          chunks: "all",
        },
      },
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [ "babel-loader", "eslint-loader" ],
      },
      {
        test: /\.scss$/,
        use: [ "style-loader", "css-loader", "sass-loader" ],
      },
      {
        test: /\.(png|svg)$/,
        use: [ "file-loader" ],
      },
      {
        test: /\.csv$/,
        use: [ "csv-loader" ],
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/,
        use: [ "file-loader" ],
      },
    ],
  },
};
