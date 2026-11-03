import { AXES, BIOMES, biomeOf, colder, tileTemperature } from "game/overworld";

describe("the biomes", () => {
  it("names all nine from temperature and moisture", () => {
    const expected = {
      "hot,dry": "desert", "hot,normal": "savanna", "hot,wet": "jungle",
      "temperate,dry": "steppe", "temperate,normal": "grassland", "temperate,wet": "marsh",
      "cold,dry": "tundra", "cold,normal": "taiga", "cold,wet": "snowfield",
    };
    const seen = new Set();
    AXES.temperature.forEach(t => AXES.moisture.forEach(m => {
      expect(biomeOf(t, m)).toEqual(expected[t + "," + m]);
      seen.add(biomeOf(t, m));
    }));
    expect(seen.size).toEqual(9);
    expect(Object.keys(BIOMES).sort()).toEqual(Object.values(expected).sort());
  });

  it("has three steps on each axis", () => {
    expect(AXES.morality).toEqual(["good", "neutral", "evil"]);
    expect(AXES.temperature).toEqual(["hot", "temperate", "cold"]);
    expect(AXES.moisture).toEqual(["wet", "normal", "dry"]);
  });
});

describe("high ground", () => {
  it("is one step colder than its world hex, down to a floor of cold", () => {
    expect(colder("hot")).toEqual("temperate");
    expect(colder("temperate")).toEqual("cold");
    expect(colder("cold")).toEqual("cold");

    expect(tileTemperature("hot", true)).toEqual("temperate");
    expect(tileTemperature("temperate", true)).toEqual("cold");
    expect(tileTemperature("cold", true)).toEqual("cold");
  });

  it("leaves low ground at its world hex's temperature", () => {
    AXES.temperature.forEach(t => expect(tileTemperature(t, false)).toEqual(t));
  });
});
