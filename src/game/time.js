const TIME = ["morning", "afternoon", "evening"];
const SEASON = ["spring", "summer", "autumn", "winter"];

export const year = clock => Math.floor(clock / 12) + 1;
export const time = clock => TIME[clock % 3];
export const season = clock => SEASON[Math.floor(clock / 3) % 4];
