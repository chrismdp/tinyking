const SEASON = ["spring", "summer", "autumn", "winter"];
const DAY = ["early", "mid", "late"];

export const DAYS_IN_SEASON = 3;
export const HOUR = 1 / 24;

export const year = t => Math.floor(t / (DAYS_IN_SEASON * SEASON.length)) + 1;

export const hour_of_day = t => (t % 1) * 24;

const twelve_hour = hour => Math.floor(hour % 12) || 12;
const am_pm = hour => twelve_hour(hour) + (hour < 12 ? "am" : "pm");

export const time = t => {
  const hour = hour_of_day(t);
  if (hour >= 6 && hour <= 12) {
    return "morning";
  } else if (hour > 12 && hour <= 18) {
    return "afternoon";
  } else if (hour > 18 && hour <= 23) {
    return "evening";
  }
  return "night";
};

export const day_of_season = t => (Math.floor(t) % DAYS_IN_SEASON);
export const season = t => SEASON[Math.floor(t / DAYS_IN_SEASON) % SEASON.length];

export const full = t => am_pm(hour_of_day(t)) + ", " + DAY[day_of_season(t)] + " " + season(t) + ", year " + year(t);
