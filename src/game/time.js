const TIME = ["morning", "afternoon", "evening", "night"];
const SEASON = ["spring", "summer", "autumn", "winter"];

export const year = clock => Math.floor(clock / (TIME.length * SEASON.length)) + 1;
export const time = clock => TIME[clock % TIME.length];
export const season = clock => SEASON[Math.floor(clock / TIME.length) % SEASON.length];
