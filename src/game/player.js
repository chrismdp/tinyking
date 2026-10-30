import { person, check_jobs } from "game/compound";
import { firstFreeJob } from "game/manager";

export const TALK_JOBS = ["chat", "ask_about", "give_gift"];
export const TALK_MINUTES = { chat: 15, ask_about: 20, give_gift: 10 };

// Keep the villager survival routines, with orders scoped to this character.
export const player = () => person().filter(([, actions]) => !actions(null).some(task => task[0] == "store_held"))
  .map(([condition, actions]) => [condition, value => actions(value).map(([key, ...args]) =>
    [key == "person" ? "player" : key == "check_jobs" ? "player_jobs" : key, ...args])]);

export const player_jobs = () => [
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
