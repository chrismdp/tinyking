// Epoch timestamps let page and service-worker marks share one timeline.
// Retain only the latest mark of each kind in the performance entry buffer.
export function saveMark(trace, name) {
  trace[name] = performance.timeOrigin + performance.now();
  const label = "tinyking:save:" + name;
  performance.clearMarks(label);
  performance.mark(label);
}
