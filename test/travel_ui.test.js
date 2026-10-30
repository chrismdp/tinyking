import { I18n } from "react-polyglot";
import messages from "../src/data/messages.json";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GameState } from "../src/components/contexts";
import { TravelOffer, TravelOverview } from "../src/components/travel";
import { community } from "./support/travel";
import { destinationFor } from "game/travel";
jest.mock("render/biomes", () => ({
  BIOME_COLOURS: Object.fromEntries(["desert", "savanna", "jungle", "steppe", "grassland", "marsh", "tundra", "taiga", "snowfield"].map(b => [b, 0x77aa44]))
}));
jest.mock("components/contexts", () => require("../src/components/contexts"), {
  virtual: true
});
jest.mock("components/overworld", () => require("../src/components/overworld"), {
  virtual: true
});
jest.mock("game/name", () => ({
  name: n => n?.nickname || "someone"
}));
const render = (s, c) => renderToStaticMarkup(<I18n locale="en" messages={messages}><GameState.Provider value={s}>{c}</GameState.Provider></I18n>);
it("offers an explicit named Travel action, one season, needs and unfinished-work policy, while ocean explains the block in the same surface", () => {
  const {
      s
    } = community(),
    id = s.map.entrances[0].tileIds[0];
  let html = render(s, <TravelOffer entityId={id} />);
  expect(html).toContain("Reach ");
  expect(html).toContain("grassland");
  expect(html).toContain("one season");
  expect(html).toContain("Hunger and tiredness");
  expect(html).toContain("cancels unfinished local tasks and favours");
  expect(html).toContain(">Travel</button>");
  expect(html).toContain(">Stay here</button>");
  destinationFor(s, id).hex.ocean = true;
  html = render(s, <TravelOffer entityId={id} />);
  expect(html).toContain("cannot cross the sea on foot");
  expect(html).not.toContain(">Travel</button>");
  expect(render(s, <TravelOverview />)).toContain("You are here");
});
it("labels the departure walk separately from its one-season journey without a false total ETA or percentage", () => {
  const {
    TaskPanel
  } = require("../src/components/task_panel");
  const {
      s,
      ids
    } = community(),
    id = ids[0];
  s.ecs.manager[id].jobs = [{
    id: "travel-job",
    job: {
      key: "travel"
    },
    targetId: s.map.entrances[0].tileIds[0],
    assignedId: id,
    progress: 0
  }];
  const html = render(s, <TaskPanel />);
  expect(html).toContain("Walking to the edge");
  expect(html).toContain("one season");
  expect(html).not.toContain("m left");
  expect(html).not.toContain("0%");
});
