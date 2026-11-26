/* global it, expect, jest */
import { generateWorldTemplate, generateWorldGame, startWorldPlayer } from "game/world_history";
import * as overworld from "game/overworld";
import { compressGame, decompressGame, replaceGame, gameData } from "game/save_game";
import { startGame } from "game/new_game";

const empty = () => ({ ecs: { nextId: 1 }, space: {}, ui: { show: {} }, redraws: [], days: .375, game_speed: "normal" });

it("ships only the world and starts the same personal game from gzip or browser generation", async () => {
  // Real history and terrain on a seven-hex world keep this regression bounded.
  const generate = overworld.generateWorld;
  const world = jest.spyOn(overworld, "generateWorld").mockImplementation(seed => generate(seed, { radius: 1 }));
  try {
    const template = empty();
    await generateWorldTemplate(template, 13);
    expect(Object.keys(template.ecs.playable || {})).toEqual([]);
    expect(Object.values(template.travel.people).some(p => p.playable)).toBe(false);
    expect(template.ui.playerId).toBeUndefined();
    expect(template.intro).toBeUndefined();
    expect(template.backstories).toBeUndefined();
    expect(template.journal).toBeUndefined();
    const loaded = empty();
    replaceGame(loaded, await decompressGame(await compressGame(template)));
    const result = startWorldPlayer(loaded);
    loaded.ui.playerId = result.playerId;
    const browser = empty();
    browser.ui.playerId = (await generateWorldGame(browser, 13)).playerId;
    expect(startGame(loaded, { skip: true })).toBe(true);
    expect(startGame(browser, { skip: true })).toBe(true);
    expect(loaded.backstories[loaded.ui.playerId]).toBeDefined();
    expect(loaded.intro.pose).toBe("standing");
    expect(Object.keys(loaded.ecs.camp)).toHaveLength(1);
    expect(gameData(loaded)).toEqual(gameData(browser));
    const id = loaded.ui.playerId;
    expect(loaded.ecs.personable[id]).toBe(loaded.travel.people[id].personable);
    expect(loaded.travel.maps[loaded.travel.active].ecs).toBe(loaded.ecs);
    expect(Object.keys(template.ecs.playable || {})).toEqual([]);
    expect(template.backstories).toBeUndefined();
  } finally { world.mockRestore(); }
}, 600000);
