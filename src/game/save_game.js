// Everything affecting play is saved. Only browser resources and the save
// controller and transient screen fades are excluded; UI actions are reattached by World on restore.
export const SAVE_VERSION = 1;
const RUNTIME = new Set(["renderer", "ticker", "personName", "redraws", "persistence", "generating", "worldBusy", "transition", "nightSleep"]);
export function gameData(state) {
  const data = Object.fromEntries(Object.entries(state).filter(([key]) => !RUNTIME.has(key)));
  if (state.ui) data.ui = Object.fromEntries(Object.entries(state.ui).filter(([key]) => key !== "actions"));
  return data;
}

// Store an object graph, rather than duplicate travel's shared identity/map
// records. Planner undefined/non-finite values must also survive JSON + gzip.
export function serialiseGame(state) {
  const nodes = [], seen = new Map();
  const encode = value => {
    if (value === undefined) return { special: "undefined" };
    if (typeof value === "number" && !Number.isFinite(value)) return { special: String(value) };
    if (value === null || typeof value !== "object") return value;
    if (seen.has(value)) return { ref: seen.get(value) };
    const ref = nodes.length;
    seen.set(value, ref);
    const node = { array: Array.isArray(value) ? value.length : null, entries: [] };
    nodes.push(node);
    node.entries = Object.entries(value).map(([key, item]) => [key, encode(item)]);
    return { ref };
  };
  const root = encode(gameData(state));
  return JSON.stringify({ version: SAVE_VERSION, root, nodes });
}

export function restoreGame(text) {
  const save = JSON.parse(text);
  if (save.version !== SAVE_VERSION) throw new Error("This save is from a different version of Tiny King. Choose Start new game to begin again.");
  const objects = save.nodes.map(node => node.array === null ? {} : new Array(node.array));
  const decode = value => {
    if (!value || typeof value !== "object") return value;
    if ("ref" in value) return objects[value.ref];
    return { undefined: undefined, NaN: NaN, Infinity: Infinity, "-Infinity": -Infinity }[value.special];
  };
  save.nodes.forEach((node, i) => node.entries.forEach(([key, value]) => { objects[i][key] = decode(value); }));
  const data = { ...decode(save.root), redraws: [] };
  if (data.game_speed && data.game_speed != "paused") data.game_speed = "normal";
  if (data.ui?.show?.journal) data.ui.show.journal = false;
  return data;
}

export function replaceGame(state, data) {
  const actions = state.ui?.actions;
  delete state.nightSleep;
  delete state.peopleDirectory;
  for (const key of Object.keys(state)) if (!RUNTIME.has(key)) delete state[key];
  Object.assign(state, data);
  if(data.travel?.people)Object.defineProperty(state,"peopleDirectory",{value:data.travel.people,writable:true,configurable:true,enumerable:false});
  state.ui = { ...data.ui, actions };
  state.redraws = Object.keys(state.ecs.spatial || {});
}

export async function compressGame(state) {
  return new Response(new Blob([serialiseGame(state)]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
}
export async function decompressGame(bytes) {
  return restoreGame(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text());
}
