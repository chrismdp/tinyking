import { attachPeople } from "./person_storage";
import { bindNewsContext } from "./event_knowledge";
// Everything affecting play is saved. Only browser resources and the save
// controller and transient screen fades are excluded; UI actions are reattached by World on restore.
export const SAVE_VERSION = 1;
const RUNTIME = new Set(["renderer", "ticker", "personName", "redraws", "persistence", "generating", "worldBusy", "transition", "nightSleep", "detailError"]);
export function gameData(state) {
  const data = Object.fromEntries(Object.entries(state).filter(([key]) => !RUNTIME.has(key)));
  if (state.ui) data.ui = Object.fromEntries(Object.entries(state.ui).filter(([key]) => key !== "actions"));
  return data;
}

// Store an object graph, rather than duplicate travel's shared identity/map
// records. Planner undefined/non-finite values must also survive JSON + gzip.
// Encode one node at a time. Weak references and consumed queue entries let
// the worker release its snapshot as gzip consumes it. No complete encoded
// graph or uncompressed JSON string is retained by the save path.
function* graphTokens(state) {
  const nodes = [], seen = new WeakMap();
  const encode = value => {
    if (value === undefined) return { special: "undefined" };
    if (typeof value === "number" && !Number.isFinite(value)) return { special: String(value) };
    if (value === null || typeof value !== "object") return value;
    if (seen.has(value)) return { ref: seen.get(value) };
    const ref = nodes.length;
    seen.set(value, ref);
    nodes.push(value);
    return { ref };
  };
  const root = encode(gameData(state));
  state = null;
  yield "{\"version\":" + SAVE_VERSION + ",\"root\":" + JSON.stringify(root) + ",\"nodes\":[";
  for (let index = 0; index < nodes.length; index++) {
    const value = nodes[index];
    nodes[index] = null;
    if (index) yield ",";
    yield "{\"array\":" + (Array.isArray(value) ? value.length : "null") + ",\"entries\":[";
    let first = true;
    for (const key of Object.keys(value)) {
      if (!first) yield ",";
      first = false;
      yield JSON.stringify([key, encode(value[key])]);
    }
    yield "]}";
  }
  yield "]}";
}

export function* gameJsonChunks(state) {
  const tokens = graphTokens(state);
  state = null;
  let chunk = "";
  for (const token of tokens) {
    for (let offset = 0; offset < token.length;) {
      const end = Math.min(token.length, offset + 65536 - chunk.length);
      chunk += token.slice(offset, end);
      offset = end;
      if (chunk.length === 65536) { yield chunk; chunk = ""; }
    }
  }
  if (chunk) yield chunk;
}

// Synchronous callers (including replay tests) still use the same v1 format.
export function serialiseGame(state) {
  return [...gameJsonChunks(state)].join("");
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
  if(state.travel?.localPeople) {
    for(const map of Object.values(state.travel.maps)){attachPeople(map,state.travel);bindNewsContext(map,state.travel);}
    attachPeople(state,state.travel);bindNewsContext(state,state.travel);
  }
  state.ui = { ...data.ui, actions };
  state.redraws = Object.keys(state.ecs.spatial || {});
}

export function compressGame(state) {
  const chunks = gameJsonChunks(state);
  state = null;
  const stream = new ReadableStream({
    pull(controller) {
      const { value, done } = chunks.next();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel() { chunks.return(); }
  });
  // TextEncoderStream preserves surrogate pairs across chunk boundaries.
  return new Response(stream.pipeThrough(new TextEncoderStream()).pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
}
export async function decompressGame(bytes) {
  return restoreGame(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text());
}
