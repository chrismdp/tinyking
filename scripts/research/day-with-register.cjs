/* eslint-disable no-undef */
process.env.NODE_ENV ||= "production";
require("../game-register");
const fs = require("node:fs");
// Match csv-loader's final empty row. The production bundle uses csv-loader itself.
require.extensions[".csv"] = (module, filename) => {
  module.exports = fs.readFileSync(filename, "utf8").split("\n").map(line => line.split(","));
};
