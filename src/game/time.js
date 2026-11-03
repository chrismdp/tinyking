const SEASON = ["spring", "summer", "autumn", "winter"];


export const DAYS_IN_SEASON = 7;
export const HOUR = 1 / 24;
export const DAYS_IN_YEAR = DAYS_IN_SEASON * SEASON.length;

// Twelve game years cover 96 years of each person's life.
export const HISTORY_SEASONS = 48;
export const HISTORY_YEARS = HISTORY_SEASONS / SEASON.length;
export const historyLabel = (completed, world = false) => `${HISTORY_YEARS} years of ${world ? "world " : ""}history: year ${Math.ceil(completed / SEASON.length)}`;
export const historyFoundingSeason = (roll, first) => first ? -HISTORY_SEASONS : -HISTORY_SEASONS / 6 - Math.floor(roll * (HISTORY_SEASONS - HISTORY_SEASONS / 6));

export const year = t => Math.floor(t / DAYS_IN_YEAR) + 1;

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

export const day_of_season = t => ((Math.floor(t) % DAYS_IN_SEASON + DAYS_IN_SEASON) % DAYS_IN_SEASON);
export const season = t => SEASON[((Math.floor(t / DAYS_IN_SEASON) % SEASON.length) + SEASON.length) % SEASON.length];

export const full = t => am_pm(hour_of_day(t)) + ", " + "day " + (day_of_season(t) + 1) + " of" + " " + season(t) + ", year " + year(t);

export const seasonPart = t => day_of_season(t) < 2 ? "early" : day_of_season(t) < 5 ? "mid" : "late";
