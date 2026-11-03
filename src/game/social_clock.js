import { LIFE_YEARS_PER_SEASON } from "game/life_stages";

// Social tuning predates the two-life-year season. Keep its original half-year
// units here so the shared life clock determines growth, probability and waits.
const FORMER_LIFE_YEARS_PER_SEASON = .5;
const scale = LIFE_YEARS_PER_SEASON / FORMER_LIFE_YEARS_PER_SEASON;
export const lifeClockRate = rate => rate * scale;
export const lifeClockChance = chance => 1 - (1 - chance) ** scale;
export const lifeClockSeasons = seasons => seasons / scale;
