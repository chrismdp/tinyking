import * as PIXI from "pixi.js";
import * as math from "game/math";
import { topController } from "game/playable";
import { fullEntity } from "game/entities";
import { Hex, InnerHex, HEX_SIZE, TRIANGLES, triangleCenters, TRIANGLE_INTERIOR_RADIUS } from "game/map";

import crops from "data/crops.json";

const HIT_RADIUS = 22.5;
const ROUTES_TO_FULL_PATH = 100;

export const person = (state, e, fn, t) => {
  const graphics = new PIXI.Graphics();
  graphics.position.set(e.spatial.x, e.spatial.y);

  const person = new PIXI.Graphics();

  if (e.personable.dead) {
    person.angle = 90;
  }
  person.hitArea = new PIXI.Circle(0, 0, HIT_RADIUS);
  person.lineStyle({color: "black", width: 2, alpha: 1});
  person.beginFill(e.personable.body);
  person.drawEllipse(0, 0, e.personable.size * 0.55, e.personable.size * 0.65);
  person.endFill();
  person.beginFill(e.personable.hair);
  person.drawCircle(0, -e.personable.size * 0.6, e.personable.size * 0.5);
  person.endFill();

  person.lineStyle(null);
  person.beginFill(0xEACAAA);
  person.drawCircle(0, -e.personable.size * 0.48, e.personable.size * 0.35);
  person.endFill();

  if (e.planner) {
    if (topController(state.ecs, e.id) == state.ui.playerId) {
      person.beginFill(0x993333);
      person.drawCircle(18, -20, 5);
    } else {
      person.beginFill(0x333333);
    }

    if (e.planner.world.label) {
      person.drawRoundedRect(-30, 20, 60, 15, 5);
      person.endFill();
      let text = new PIXI.Text(t("tasks." + e.planner.world.label), {fontFamily: "Alegreya", fontSize: 10, fill: "white"});
      text.position.set(0, 27.5);
      text.anchor = { x: 0.5, y: 0.5 };
      person.addChild(text);
    }
  }

  if (fn) { fn(person, graphics); }

  if (e.holder) {
    e.holder.held.forEach((id, idx) => {
      const [, item] = entity(state, id, t, true);
      item.position.set(-5 + idx * 10, 0);
      person.addChild(item);
    });
  }

  graphics.addChild(person);
  return graphics;
};

export const COLOURS = {
  "mountain": 0x3C3A44,
  "deep water": 0x2F4999,
  "shallow water": 0x3F6FAE,
  "grassland": 0x80C05D,
  "sown": 0x6C4332,
  "growing": 0x6C4332,
  "harvestable": 0xE2C879,
  "dirt": 0x6C4332,
  "field": 0x5A5C46,
  "stone": 0x5D7084,
};

const itemColours = {
  "wood": COLOURS.dirt,
  "grain": COLOURS.harvestable,
  "gruel": 0x7A845C
};

const item = (ecs, id) => {
  const graphics = new PIXI.Graphics();
  graphics.position.set(ecs.spatial[id].x, ecs.spatial[id].y);
  graphics.beginFill(itemColours[ecs.good[id].type]);
  graphics.drawCircle(0, 0, 10);
  graphics.endFill();
  return graphics;
};

const stockpile = (state, id, t) => {
  const graphics = new PIXI.Graphics();
  graphics.position.set(state.ecs.spatial[id].x, state.ecs.spatial[id].y);
  graphics.beginFill(COLOURS.stone, 0.25);
  graphics.drawPolygon(InnerHex().corners());
  graphics.endFill();
  let text = new PIXI.Text(state.ecs.holder[id].capacity, {fontFamily: "Alegreya", fontSize: 20, fill: "white"});
  text.anchor = { x: 0.5, y: 0.5 };
  graphics.addChild(text);

  const space = state.space[Hex().fromPoint(state.ecs.spatial[id])];
  const drawDebug = false;
  if (drawDebug) {
    triangleCenters({x: 0, y: 0}).forEach(p => {
      const occupied = space.some(e =>
        state.ecs.haulable && state.ecs.haulable[e] &&
        e != id &&
        math.squaredDistance({x: p.x + state.ecs.spatial[id].x, y: p.y + state.ecs.spatial[id].y}, state.ecs.spatial[e]) <
        TRIANGLE_INTERIOR_RADIUS * TRIANGLE_INTERIOR_RADIUS);
      graphics.beginFill(occupied ? 0xff0000 : 0x00ff00);
      graphics.drawCircle(p.x, p.y, TRIANGLE_INTERIOR_RADIUS * 1.25);
    });
  }

  if (state.ecs.holder[id]) {
    state.ecs.holder[id].held.forEach(itemId => {
      const [, item] = entity(state, itemId, t, true);
      item.position.set(
        item.position.x - state.ecs.spatial[id].x,
        item.position.y - state.ecs.spatial[id].y
      );
      graphics.addChild(item);
    });
  }

  return graphics;
};

const tree = (ecs, id) => {
  const graphics = new PIXI.Graphics();
  graphics.position.set(ecs.spatial[id].x, ecs.spatial[id].y);
  graphics.beginFill(0x30512F);
  graphics.lineStyle({color: "black", width: 2, alpha: 0.1});
  const amount = ecs.good[id].amount;
  graphics.drawCircle(0, 0, HEX_SIZE * (0.1 + amount * 0.1));
  graphics.endFill();
  return graphics;
};

const tile = (ecs, id) => {
  const graphics = new PIXI.Graphics();
  graphics.position.set(ecs.spatial[id].x, ecs.spatial[id].y);

  graphics.beginFill(COLOURS[ecs.mappable[id].terrain]);
  graphics.lineStyle({color: "black", width: 2, alpha: 0.04});
  const corners = Hex().corners();
  graphics.drawPolygon(...corners);
  graphics.endFill();
  graphics.lineStyle();
  for (const key in ecs.walkable[id].worn) {
    const [ entrance, exit ] = key.split(",").map(i => i == "C" ? "C" : +i);
    graphics.beginFill(COLOURS.dirt, Math.min(1.0, ecs.walkable[id].worn[key] / ROUTES_TO_FULL_PATH));
    const center = { x: 0, y: 0 };
    const line = {
      entrance: [
        entrance != "C" ? corners[entrance] : center,
        entrance != "C" ? corners[(entrance + 1) % 6] : center
      ],
      exit: [
        exit != "C" ? corners[exit] : center,
        exit != "C" ? corners[(exit + 1) % 6] : center
      ]
    };
    graphics.drawPolygon([
      math.lerp(...line.entrance, 0.25),
      math.lerp(...line.entrance, 0.75),
      math.lerp(...line.exit, 0.25),
      math.lerp(...line.exit, 0.75),
    ]);
  }
  // NOTE: Debug for showing paths between hexes
  // if (ecs.walkable[id]) {
  //   graphics.beginFill(0xFF0000);
  //   Object.keys(ecs.walkable[id].neighbours).forEach(side => graphics.drawCircle(
  //     Math.sin(2 * Math.PI * ((+side + 2) % 6) / 6) * HEX_SIZE * 0.8,
  //     -Math.cos(2 * Math.PI * ((+side + 2) % 6) / 6) * HEX_SIZE * 0.8,
  //     5)
  //   );
  // }
  return graphics;
};

const field = (state, id) => {
  const graphics = new PIXI.Graphics();
  graphics.position.set(state.ecs.spatial[id].x, state.ecs.spatial[id].y);
  graphics.beginFill(COLOURS.field, 0.25);
  graphics.drawPolygon(Hex().corners());

  graphics.lineStyle();
  state.ecs.farmable[id].slots.forEach((slot, idx) => {
    if (["harvested", "harvestable", "ploughed", "sown"].includes(slot.state)) {
      graphics.beginFill(COLOURS.dirt);
      graphics.drawRoundedRect(TRIANGLES[idx].x - 15, TRIANGLES[idx].y - 6, 30, 12, 3);
    }
    if (["harvested"].includes(slot.state)) {
      graphics.beginFill(0x000000, 0.5);
      graphics.drawCircle(TRIANGLES[idx].x, TRIANGLES[idx].y, 5);
    } else if (["harvestable", "sown"].includes(slot.state)) {
      graphics.beginFill(parseInt(crops[slot.content].colour, 16));
      const radius = Math.min(6,
        Math.max(2,
          (state.days - slot.updated) * 6 / crops[slot.content].growingTime));
      graphics.drawCircle(TRIANGLES[idx].x, TRIANGLES[idx].y, radius);
    }
  });
  graphics.scale.set(0.9, 0.9);
  graphics.anchor = { x: 0.5, y: 0.5 };

  return graphics;
};

const GOLDEN_RATIO = 1.618034;

const building = (state, id) => {
  const graphics = new PIXI.Graphics();
  graphics.position.set(state.ecs.spatial[id].x, state.ecs.spatial[id].y);

  graphics.beginFill(0x6C4332);
  graphics.lineStyle({color: "black", width: 2, alpha: 1});
  const w = HEX_SIZE * 1.35;
  const h = w / GOLDEN_RATIO;
  graphics.drawRect(-w * 0.5, -h * 0.5, w, h);
  graphics.beginFill(0x000000);
  graphics.drawRect(-w * 0.15, h * 0.5 - 2, w * 0.3, 5);
  graphics.rotation = 2 * Math.PI * (state.ecs.building[id].entrance - 1) / 6;

  if (topController(state.ecs, id) == state.ui.playerId) {
    graphics.beginFill(0x993333);
    graphics.drawCircle(0, 0, 8);
  }

  return graphics;
};


export const entity = (state, id, t, heldObjects) => {
  // NOTE: Do nothing - we don't render these yet.
  if (state.ecs.interior[id]) {
    return [];
  }

  if (state.ecs.mappable[id]) {
    const result = ["tiles", tile(state.ecs, id)];
    return result;

  }


  if (state.ecs.haulable && state.ecs.haulable[id]) {
    if (heldObjects || !state.ecs.haulable[id].heldBy) {
      return ["haulable", item(state.ecs, id)];
    } else {
      return [];
    }
  }

  // NOTE: Must come _after_ haulable as otherwise logs would be rendered as trees!
  if (state.ecs.good[id] && state.ecs.good[id].type == "wood") {
    return ["buildings", tree(state.ecs, id)];
  }

  if (state.ecs.building[id]) {
    return ["buildings", building(state, id)];
  }

  if (state.ecs.personable[id]) {
    const e = fullEntity(state.ecs, id);
    return ["people", person(state, e, (person) => {
      if (state.ui.show.selected_person == id) {
        person.lineStyle({color: 0xff0000, width: 2, alpha: 1});
        person.moveTo(-25, -25);
        person.lineTo(-25, -30);
        person.lineTo(-20, -30);

        person.moveTo(20, -30);
        person.lineTo(25, -30);
        person.lineTo(25, -25);

        person.moveTo(25, 15);
        person.lineTo(25, 20);
        person.lineTo(20, 20);

        person.moveTo(-20, 20);
        person.lineTo(-25, 20);
        person.lineTo(-25, 15);
      }
    }, t)];
  }

  if (state.ecs.farmable && state.ecs.farmable[id]) {
    return ["stockpiles", field(state, id)];
  }

  if (state.ecs.stockpile && state.ecs.stockpile[id]) {
    return ["stockpiles", stockpile(state, id, t)];
  }

  const e = fullEntity(state.ecs, id);
  throw "Cannot render entity " + id + " heldObjects is " + heldObjects + ":" + JSON.stringify(e);
};

