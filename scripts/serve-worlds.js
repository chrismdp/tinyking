/* eslint-disable no-undef */
// The dev server uses the same routes as production, with a folder as its bucket.
require("./game-register");
const { readdir, stat } = require("node:fs/promises");
const { createReadStream } = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const worker = require("../src/worker").default;
const directory = path.resolve(__dirname, "../worlds");

const WORLDS = {
  async list({ prefix }) {
    const entries = await readdir(path.join(directory, prefix), { withFileTypes: true }).catch(error => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    return { objects: entries.filter(entry => entry.isFile()).map(entry => ({ key: prefix + entry.name })), truncated: false };
  },
  async get(key) {
    const filename = path.join(directory, key);
    try { if (!(await stat(filename)).isFile()) return null; }
    catch (error) { if (error.code === "ENOENT") return null; throw error; }
    return { body: Readable.toWeb(createReadStream(filename)) };
  }
};

module.exports = async function serveWorlds(req, res, next) {
  if (!new URL(req.url, "http://localhost").pathname.startsWith("/worlds")) return next();
  try {
    const response = await worker.fetch(new Request("http://localhost" + req.url, { method: req.method }), { WORLDS });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    await pipeline(Readable.fromWeb(response.body), res);
  } catch (error) { next(error); }
};
