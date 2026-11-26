import { WORLD_PREFIX, parseWorldKey, parseWorldWeek, worldKey, worldWeek } from "./game/world_weeks";

async function listWeeks(bucket) {
  const weeks = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix: WORLD_PREFIX, ...(cursor ? { cursor } : {}) });
    for (const object of page.objects) {
      const week = parseWorldKey(object.key);
      if (week) weeks.push(week);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return weeks.sort((a, b) => b.id.localeCompare(a.id));
}

const missing = () => new Response("World not found", { status: 404, headers: { "Cache-Control": "no-store" } });

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith("/worlds")) return env.ASSETS.fetch(request);
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { Allow: "GET" } });
    if (path === "/worlds") {
      return Response.json(await listWeeks(env.WORLDS), { headers: { "Cache-Control": "public, max-age=60" } });
    }
    const current = path === "/worlds/current.json.gz";
    const match = /^\/worlds\/(\d{4}-W\d{2})\.json\.gz$/.exec(path);
    const week = current ? (await listWeeks(env.WORLDS))[0] : match && parseWorldWeek(match[1]);
    if (!week) return missing();
    const object = await env.WORLDS.get(worldKey(week.id));
    if (!object) return missing();
    return new Response(object.body, { headers: {
      "Content-Type": "application/gzip",
      "Cache-Control": "public, max-age=" + (!current && week.id < worldWeek().id ? 31536000 : 60)
    } });
  }
};
