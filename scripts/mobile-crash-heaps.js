/* eslint-disable no-undef */
const fs = require("fs"), path = require("path");

// Read snapshot metadata without loading a multi-gigabyte snapshot into another
// JS heap. The raw snapshots remain available for Chrome's retained-object view.
module.exports = function summarizeHeaps(dir) {
  const summary = {};
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith(".heapsnapshot"))) {
    const name = path.join(dir, file), fd = fs.openSync(name, "r"), header = Buffer.alloc(8192);
    let length;
    try { length = fs.readSync(fd, header, 0, header.length, 0); }
    finally { fs.closeSync(fd); }
    const prefix = header.toString("utf8", 0, length).split("\"nodes\":[")[0].trim().replace(/,$/, "");
    const metadata = JSON.parse(prefix + "}").snapshot;
    summary[file] = { nodes: metadata.node_count, edges: metadata.edge_count, fileBytes: fs.statSync(name).size };
  }
  const profile = JSON.parse(fs.readFileSync(path.join(dir, "worker-allocations.json"), "utf8"));
  const frames = [];
  function walk(node) {
    if (node.selfSize) frames.push({ function: node.callFrame.functionName, url: node.callFrame.url, line: node.callFrame.lineNumber, bytes: node.selfSize });
    for (const child of node.children || []) walk(child);
  }
  walk(profile.profile.head);
  summary.allocations = frames.sort((a, b) => b.bytes - a.bytes).slice(0, 20);
  fs.writeFileSync(path.join(dir, "heap-summary.json"), JSON.stringify(summary, null, 2));
  return summary;
};
