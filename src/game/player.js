import { person, check_jobs } from "game/compound";
import { firstFreeJob } from "game/manager";

export const TALK_JOBS = ["chat", "ask_about", "give_gift"];
export const TALK_MINUTES = { chat: 15, ask_about: 20, give_gift: 10 };

// Keep the villager survival routines, with orders scoped to this character.
export const player = () => [
  [world => world.stationaryPlayer === false, () => [["person"]]],
  [world => world.stationaryPlayer && !world.playerWorking && (world.feeling.hungry || world.feeling.tired), () => [["stationary_needs"]]],
  ...person().filter(([, actions]) => !actions(null).some(task => ["store_held", "farm", "work_trade", "haul", "idle_person", "social_visit", "tend_garden", "child_idle", "begin_friend_help", "arrive_home"].includes(task[0])))
    .map(([condition, actions]) => {
      const need = actions(null).some(task => ["find_food", "go_to_sleep"].includes(task[0]));
      return [world => (!need || !world.stationaryPlayer || world.playerWorking) && condition(world), value => actions(value).map(([key, ...args]) =>
        [key == "person" ? "player" : key == "check_jobs" ? "player_jobs" : key, ...args])];
    }),
  [() => true, () => [["wait_for", 1 / 48]]]
];

export const stationary_needs = () => [
  [world => world.feeling.hungry && world.careMeal, meal => [
    ...(meal.kind == "held" ? [] : [[{ container: "pick_up_from_container", stockpile: "pick_up_from_stockpile", loose: "pick_up_entity_with_good" }[meal.kind], "idleFoodSource", meal.type]]),
    ["eat", meal.type]
  ]],
  [world => world.feeling.tired && world.careBed && (world.days % 1 * 24 >= 20 || world.days % 1 * 24 < 9), () => [["sleep"]]],
  [() => true, () => [["wait_for", 1 / 48]]]
];

export const player_jobs = () => [
  [(_, jobs) => firstFreeJob(jobs, "find_food"), () => [["take_job", "find_food"], ["ordered_meal"], ["complete_job", "find_food"]]],
  [(_, jobs) => firstFreeJob(jobs, "rest"), () => [["take_job", "rest"], ["move_to_place", "sleep", "allows_sleep"], ["sleep"], ["complete_job", "rest"]]],
  [(_, jobs) => firstFreeJob(jobs, "travel"), entry => [["take_job", "travel"], ["walk_to", entry.targetId], ["leave_edge", entry.targetId, entry]]],
  [(_, jobs) => firstFreeJob(jobs, "favour"), entry => [["take_job", "favour"], ["do_favour", entry.favourId], ["complete_job", "favour"]]],
  ...TALK_JOBS.map(key => [
    (_, jobs) => firstFreeJob(jobs, key),
    entry => {
      const gift = key == "give_gift" && !entry.giftItem ? [
        ...(entry.gift.possession?.carried ? [] : [["walk_to", entry.gift.sourceId]]), ["collect_gift", entry.gift.sourceId, entry.gift.type]
      ] : [];
      return [["take_job", key], ...gift, ["get_attention", entry.targetId],
        ["walk_to", entry.targetId], ["set_label", key],
        ["talk", entry.targetId, key, entry.aboutId, entry.gift?.type],
        ["release_attention", entry.targetId], ["complete_job", key]];
    }
  ]),
  ...check_jobs()
];

export const ordered_meal = () => [
  [world => world.feeling.hungry, () => [["find_food"]]],
  [() => true, () => [["set_label"]]]
];
