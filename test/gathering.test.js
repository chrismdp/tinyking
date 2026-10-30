import { eveningPlace } from "game/villages";
import { hashUnit } from "game/math";

const choice = (id, day = 0) => Math.floor(hashUnit(id + ":evening:" + day) * 2);
const idsFor = venue => Array.from({ length: 100 }, (_, i) => String(i + 1)).filter(id => choice(id) == venue);
const green = { x: 0, y: 0 }, alehouse = { x: 100, y: 0 };
const fixture = (people, points = [[green, alehouse], [alehouse, green]]) => ({
  days: 0.8,
  villages: { home: { id: "home", sharedPlaces: ["green", "alehouse"] } },
  ecs: {
    personable: Object.fromEntries(people.map(id => [id, {}])),
    village: Object.fromEntries(people.map(id => [id, { villageId: "home" }])),
    meetingPlace: {
      green: { kind: "green", gatheringPoints: points[0] },
      alehouse: { kind: "alehouse", gatheringPoints: points[1] }
    }
  }
});

it("assigns the actual visitors at each venue, without consuming spaces for the other venue's visitors", () => {
  const a = idsFor(0)[0], b = idsFor(1)[0];
  const s = fixture([a, b]);
  expect(eveningPlace(s, a)).toEqual({ id: "green", ...green });
  expect(eveningPlace(s, b)).toEqual({ id: "alehouse", ...alehouse });
});

it("can give a shared space to a constrained venue by moving another assignment to its alternative", () => {
  const a = idsFor(0)[0], b = idsFor(1)[0];
  const s = fixture([a, b], [[green, alehouse], [green]]);
  expect(eveningPlace(s, a)).toEqual({ id: "green", ...alehouse });
  expect(eveningPlace(s, b)).toEqual({ id: "alehouse", ...green });
  expect(eveningPlace(s, b)).toEqual(eveningPlace(structuredClone(s), b));
});

it("uses another local venue's available space when a preferred venue is full", () => {
  const [a, b] = idsFor(0);
  const s = fixture([a, b], [[green], [alehouse]]);
  expect(eveningPlace(s, a)).toEqual({ id: "green", ...green });
  expect(eveningPlace(s, b)).toEqual({ id: "alehouse", ...alehouse });
});

it("recomputes from living local visitors and current venues after arrivals, deaths, moves and day changes", () => {
  const [a, b, c] = idsFor(0);
  const s = fixture([a, b], [[green, alehouse], [alehouse, green]]);
  expect(eveningPlace(s, b).x).toBe(100);
  s.ecs.personable[a].dead = true;
  expect(eveningPlace(s, b)).toEqual({ id: "green", ...green });
  expect(eveningPlace(s, a)).toBeNull();
  s.ecs.personable[c] = {};
  s.ecs.village[c] = { villageId: "home" };
  expect(eveningPlace(s, c)).toEqual({ id: "green", ...alehouse });
  s.ecs.village[b].villageId = "away";
  expect(eveningPlace(s, c)).toEqual({ id: "green", ...green });
  s.days = 1.8;
  const venue = choice(c, 1) ? "alehouse" : "green";
  expect(eveningPlace(s, c).id).toBe(venue);
  s.villages.home.sharedPlaces = ["alehouse"];
  expect(eveningPlace(s, c)).toEqual({ id: "alehouse", ...alehouse });
});
